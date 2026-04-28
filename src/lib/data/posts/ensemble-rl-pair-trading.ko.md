---
title: "앙상블 RL 페어 트레이딩 — QR-DQN 정체기에서 Sharpe 1.97까지"
subtitle: "데이터가 많을수록 성능이 떨어질 때, 답은 더 많은 데이터가 아니라 더 똑똑한 그룹화, 레짐 감지, 그리고 어떤 그룹을 신뢰할지 배우는 밴딧이다."
date: "2026-04-28"
tags: ["강화학습", "페어 트레이딩", "앙상블 방법론", "톰슨 샘플링", "HMM", "퀀트 파이낸스"]
summary: "13라운드의 QR-DQN 실험이 벽에 부딪혔다: 최고 모델(R6, +5.857)은 44개 환경만 사용했고, 449개 심볼로 확장하면 오히려 악화되었다. 해결책은 450개 심볼을 19개 GICS 섹터 그룹으로 나누고, 그룹별 HMM 레짐 감지를 수행하고, 레짐 조건 전략(모멘텀/QR-DQN/방어적 숏)을 적용하고, 톰슨 샘플링으로 어떤 그룹이 수익성 있는 신호를 만드는지 학습하는 앙상블이었다. 275일 OOS 백테스트: Sharpe 1.97, 수익률 +20.80%, MDD 4.93%."
lang: ko
---

> **TL;DR.** QR-DQN을 더 많은 심볼로 확장하면 오히려 성능이 떨어졌다. 앙상블
> 아키텍처 — GICS 섹터 그룹, HMM 레짐 감지, 레짐 조건 전략, 톰슨 샘플링
> 밴딧 — 으로 275일 OOS에서 Sharpe 1.97, 수익률 +20.80%를 달성했다.
> 같은 기간 SPY 수익률은 0%.

---

## 0. 문제: QR-DQN의 정체

13라운드의 QR-DQN 실험(R0~R15)을 진행했다. 요약 테이블:

```
라운드  심볼수   환경수  best_eval   비고
──────  ──────  ──────  ─────────   ──────────────────────
R0      20       10     +1.203      베이스라인, 작은 유니버스
R1      50       25     +2.441      페어 추가 시 개선
R2      100      48     +3.912      여전히 스케일링 중
R3      150      72     +4.150      수익 체감 시작
R4      200      96     +4.380      미미한 개선
R5      100      44     +5.102      작은 정제된 세트
R6      92       44     +5.857      *** 프로덕션 모델 ***
R7      200      96     +4.201      큰 세트로 복귀, 악화
R8      300      140    +3.890      더 많은 데이터 = 더 나쁜 결과
R10     449      213    +2.744      전체 유니버스, 최악
R12     449      213    +2.901      튜닝 재시도, 여전히 나쁨
R15     100      48     +5.340      작은 세트로 복귀, 회복
```

패턴은 명확하다: **작고 고품질인 그룹이 크고 노이즈가 많은 데이터셋을 이긴다.**

R6이 최적점이었다 — 92개 심볼, 44개 훈련 환경, 최고 평가 보상 +5.857. 449개
심볼(213개 환경)으로 확장하면 +2.744로 떨어졌다. 모델이 레짐이 맞지 않는
페어들에 빠져 있었다.

핵심 통찰: Tech 섹터의 페어는 Utilities 페어와 전혀 다르게 움직인다. 모든
섹터에 걸쳐 하나의 정책을 학습하려는 단일 모델은 근본적으로 다른 역학을
평균내야 한다. 해결책은 더 큰 모델이 아니다. 해결책은 앙상블이다.

---

## 1. 앙상블 아키텍처 개요

```
                        450개 심볼
                            |
                    GICS 섹터 분할
                            |
            ┌───────────────┼───────────────┐
            v               v               v
      Tech_0 (28)    Health_0 (22)   Energy_0 (18)   ... 19개 그룹
            |               |               |
      HMM 3-상태       HMM 3-상태       HMM 3-상태
      레짐 감지         레짐 감지         레짐 감지
            |               |               |
     ┌──────┼──────┐  ┌────┼──────┐  ┌────┼──────┐
     v      v      v  v    v      v  v    v      v
   상승   횡보   하락  ...
     |      |      |
  모멘텀  QR-DQN  방어적
  (상위3) 페어    숏
     |      |      |
     └──────┼──────┘
            v
   톰슨 샘플링 밴딧
   (그룹 수준 팔 선택)
            |
            v
     포트폴리오 배분기
```

파이프라인은 네 계층으로 구성된다:

1. **GICS 섹터 그룹화** — 450개 심볼을 각 15-30개의 19개 그룹으로
2. **HMM 레짐 감지** — 그룹별 3-상태 (상승 / 횡보 / 하락)
3. **레짐 조건 전략** — 레짐별 다른 전략 적용
4. **톰슨 샘플링 밴딧** — 어떤 그룹을 신뢰할지 학습

---

## 2. GICS 섹터 그룹화

왜 GICS인가? 같은 섹터 내 페어들은 근본적인 동인을 공유하기 때문이다.
Tech 주식들은 반도체 수요, 금리 기대, AI 자본 지출에 함께 움직인다.
에너지 주식들은 유가, OPEC 결정, 시추 횟수에 함께 움직인다.
섹터 간 페어는 QR-DQN이 모델링할 수 없는 노이즈를 도입한다.

```python
SECTOR_GROUPS = {
    "Tech_0":       ["AAPL", "MSFT", "NVDA", "AMD", "INTC", ...],  # 28
    "Tech_1":       ["CRM", "ADBE", "NOW", "SNOW", "PLTR", ...],   # 24
    "Health_0":     ["JNJ", "UNH", "PFE", "MRK", "ABT", ...],     # 22
    "Health_1":     ["ISRG", "DXCM", "VEEV", "HIMS", ...],        # 18
    "Energy_0":     ["XOM", "CVX", "COP", "SLB", "EOG", ...],     # 18
    "Finance_0":    ["JPM", "BAC", "GS", "MS", "WFC", ...],       # 26
    "Finance_1":    ["AXP", "SCHW", "BLK", "ICE", ...],           # 20
    "Consumer_0":   ["AMZN", "TSLA", "HD", "NKE", "SBUX", ...],   # 25
    "Consumer_1":   ["PG", "KO", "PEP", "CL", "COST", ...],       # 22
    "Industrial_0": ["CAT", "DE", "HON", "GE", "RTX", ...],       # 24
    "Industrial_1": ["UPS", "FDX", "LMT", "NOC", ...],            # 19
    "Utility_0":    ["NEE", "DUK", "SO", "D", "AEP", ...],        # 16
    "Material_0":   ["LIN", "APD", "SHW", "ECL", "NEM", ...],     # 17
    "RealEstate_0": ["AMT", "PLD", "CCI", "EQIX", ...],           # 15
    "Comm_0":       ["GOOG", "META", "NFLX", "DIS", ...],         # 20
    "Comm_1":       ["T", "VZ", "TMUS", "CHTR", ...],             # 16
    "Biotech_0":    ["AMGN", "GILD", "REGN", "VRTX", ...],        # 18
    "Semicon_0":    ["TSM", "AVGO", "QCOM", "MU", "LRCX", ...],   # 22
    "Software_0":   ["ORCL", "INTU", "PANW", "FTNT", ...],        # 19
}
# 총계: 19개 그룹, ~450개 심볼
```

각 그룹은 15-30개 심볼이다. 이는 R6이 최적 성능을 보인 규모와 대략 일치한다.

---

## 3. HMM 레짐 감지

각 섹터 그룹은 자체적인 3-상태 Hidden Markov Model을 갖는다.
그룹의 동일 가중 일일 수익률로 훈련한다.

```python
from hmmlearn.hmm import GaussianHMM

class SectorRegimeDetector:
    def __init__(self, n_states=3, lookback=252):
        self.hmm = GaussianHMM(
            n_components=n_states,
            covariance_type="diag",
            n_iter=100,
            random_state=42,
        )
        self.lookback = lookback
        self.state_labels = {}

    def fit(self, group_returns: np.ndarray):
        """group_returns: (T, n_features), n_features = [평균수익률, 변동성, 상관관계]"""
        self.hmm.fit(group_returns[-self.lookback:])
        self._label_states(group_returns)

    def _label_states(self, returns):
        """평균 수익률 기준 상태 레이블: 최고=상승, 최저=하락, 중간=횡보"""
        means = self.hmm.means_[:, 0]
        order = np.argsort(means)
        self.state_labels = {
            order[0]: "Bear",
            order[1]: "Sideways",
            order[2]: "Bull",
        }

    def predict_regime(self, recent_returns: np.ndarray) -> str:
        state = self.hmm.predict(recent_returns[-20:].reshape(-1, 1))[-1]
        return self.state_labels[state]
```

HMM 피처 (그룹별):

```
피처 0: 동일 가중 평균 일일 수익률 (20일 이동)
피처 1: 평균 페어 상관관계 (20일 이동)
피처 2: 그룹 변동성 (수익률의 20일 이동 표준편차)
```

상관관계 피처가 중요하다. 하락 시장에서 상관관계가 급등하고(모두가 매도),
상승 시장에서 상관관계가 하락한다(종목 선별이 중요). 이 피처만으로 레짐
분류 정확도가 수익률만 사용할 때 대비 ~12% 향상되었다.

### 레짐 전이 행렬 (Tech_0 학습 결과)

```
             도착:
출발:     상승    횡보    하락
상승    [ 0.92    0.06    0.02 ]
횡보    [ 0.08    0.84    0.08 ]
하락    [ 0.03    0.12    0.85 ]

평균 지속 기간: 상승=12.5일, 횡보=6.3일, 하락=6.7일
```

상승 레짐은 끈적하다(0.92 자기 전이). 하락 레짐은 짧지만 급격하다. 횡보가
가장 불안정한 상태이며, 이것이 바로 페어 트레이딩이 여기서 가장 잘 작동하는
이유다 — 시장이 레인지 바운드일 때 평균 회귀가 가장 강하다.

---

## 4. 레짐 조건 전략

각 레짐은 다른 전략으로 전환된다:

### 상승 레짐: 모멘텀 (20일 수익률 상위 3종목)

```python
def bull_strategy(group_symbols, price_data):
    """상승장에서는 모멘텀을 따른다 — 페어 트레이딩이 열위."""
    returns_20d = {}
    for sym in group_symbols:
        ret = (price_data[sym][-1] / price_data[sym][-20] - 1)
        returns_20d[sym] = ret

    top_3 = sorted(returns_20d, key=returns_20d.get, reverse=True)[:3]
    return [Signal(sym=s, direction="long", weight=1/3) for s in top_3]
```

왜 상승장에서 페어 트레이딩을 하지 않는가? 강한 상승 추세에서 평균 회귀
신호는 모멘텀에 짓밟히기 때문이다. 스프레드가 벌어지고 계속 벌어진다.
R6 백테스트에서 확인: 상승 레짐에서 승률이 58%에서 41%로 하락했다.

### 횡보 레짐: QR-DQN 페어 트레이딩 (R6 프로덕션 모델)

R6 모델이 빛나는 곳이다. 횡보 시장은 평균 회귀하는 스프레드, 적당한 변동성,
안정적인 상관관계를 갖는다.

```python
def sideways_strategy(group_symbols, price_data, qrdqn_agent):
    """횡보 -> QR-DQN 페어 트레이딩, 최적 환경."""
    pairs = select_cointegrated_pairs(group_symbols, price_data, top_k=5)
    signals = []

    for sym_a, sym_b in pairs:
        state_28d = build_state_vector(sym_a, sym_b, price_data)
        # 상태: [스프레드, z점수, 반감기, 변동성비율, 상관관계_20일,
        #        rsi_a, rsi_b, macd_a, macd_b, bb위치_a, bb위치_b,
        #        거래량비율_a, 거래량비율_b, atr_a, atr_b,
        #        섹터모멘텀, vix, 금리스프레드, ...]  -> 28차원

        action = qrdqn_agent.act(state_28d)    # 0=보유, 1=롱, 2=숏
        cvar   = qrdqn_agent.cvar(state_28d, action, alpha=0.05)
        unc    = qrdqn_agent.uncertainty(state_28d, action)

        # 신뢰도 스케일링: 높은 불확실성 -> 작은 포지션
        confidence = max(0.2, 1.0 - unc / 2.0)

        if action == 1:  # 롱 스프레드
            signals.append(Signal(
                sym_long=sym_a, sym_short=sym_b,
                confidence=confidence, cvar=cvar,
            ))
        elif action == 2:  # 숏 스프레드
            signals.append(Signal(
                sym_long=sym_b, sym_short=sym_a,
                confidence=confidence, cvar=cvar,
            ))

    return signals
```

### 하락 레짐: 방어적 숏 (모멘텀 하위 2종목)

```python
def bear_strategy(group_symbols, price_data):
    """하락장에서 그룹 내 가장 약한 종목을 숏한다."""
    returns_20d = {}
    for sym in group_symbols:
        ret = (price_data[sym][-1] / price_data[sym][-20] - 1)
        returns_20d[sym] = ret

    bottom_2 = sorted(returns_20d, key=returns_20d.get)[:2]
    return [Signal(sym=s, direction="short", weight=1/2) for s in bottom_2]
```

### 폴백: z-score 임계값

QR-DQN 모델이 사용 불가능할 때(체크포인트 누락, 차원 불일치, 파일 손상),
횡보 전략은 클래식 z-score 임계값으로 대체된다:

```python
def zscore_fallback(sym_a, sym_b, price_data, entry=2.0, exit=0.5):
    """QR-DQN 사용 불가 시 클래식 통계적 차익거래 폴백."""
    spread = compute_spread(sym_a, sym_b, price_data)
    z = (spread[-1] - spread.mean()) / spread.std()

    if z > entry:
        return Signal(sym_long=sym_b, sym_short=sym_a, confidence=0.5)
    elif z < -entry:
        return Signal(sym_long=sym_a, sym_short=sym_b, confidence=0.5)
    return None
```

---

## 5. QR-DQN 통합 세부사항

R6 프로덕션 모델 사양:

```
아키텍처:       MLP 28 -> 128 -> 128 -> 3*51
상태 차원:      28
행동:           3 (보유 / 롱스프레드 / 숏스프레드)
분위수:         51 (tau_i = (2i-1) / (2*51), i=1..51)
best_eval:      +5.857
훈련 환경:      44
훈련 스텝:      500K
옵티마이저:     Adam, lr=6.25e-5
배치 크기:      32
리플레이 버퍼:  100K, PER alpha=0.6, beta 0.4->1.0 어닐링
n-step:         3
감마:           0.99
타겟 업데이트:  매 8000 스텝
```

### 28차원 상태 벡터 구축

```python
def build_state_vector(sym_a, sym_b, data, lookback=60):
    """원시 가격 데이터에서 28차원 상태 벡터를 구축한다."""
    pa, pb = data[sym_a][-lookback:], data[sym_b][-lookback:]

    spread = pa / pb
    z_score = (spread[-1] - spread.mean()) / (spread.std() + 1e-8)
    half_life = calc_half_life(spread)

    state = np.array([
        spread[-1],                          # 0: 원시 스프레드
        z_score,                             # 1: z-점수
        half_life,                           # 2: 평균 회귀 반감기
        pa.std() / (pb.std() + 1e-8),        # 3: 변동성 비율
        np.corrcoef(pa, pb)[0, 1],           # 4: 상관관계 (60일)
        calc_rsi(pa, 14),                    # 5: RSI sym_a
        calc_rsi(pb, 14),                    # 6: RSI sym_b
        calc_macd(pa),                       # 7: MACD sym_a
        calc_macd(pb),                       # 8: MACD sym_b
        calc_bb_position(pa),                # 9: 볼린저 밴드 위치 sym_a
        calc_bb_position(pb),                # 10: BB 위치 sym_b
        volume_ratio(data, sym_a),           # 11: 거래량 비율 sym_a
        volume_ratio(data, sym_b),           # 12: 거래량 비율 sym_b
        calc_atr(data, sym_a, 14),           # 13: ATR sym_a
        calc_atr(data, sym_b, 14),           # 14: ATR sym_b
        sector_momentum(data, sym_a),        # 15: 섹터 모멘텀
        data["VIX"][-1],                     # 16: VIX
        data["RATE_SPREAD"][-1],             # 17: 10년-2년 금리 스프레드
        np.corrcoef(pa[-20:], pb[-20:])[0,1],# 18: 단기 상관관계 (20일)
        spread[-5:].mean() - spread.mean(),  # 19: 스프레드 모멘텀 (5일)
        calc_hurst(spread),                  # 20: 허스트 지수
        skew(np.diff(np.log(pa))),           # 21: 수익률 왜도 sym_a
        skew(np.diff(np.log(pb))),           # 22: 수익률 왜도 sym_b
        kurtosis(np.diff(np.log(pa))),       # 23: 수익률 첨도 sym_a
        kurtosis(np.diff(np.log(pb))),       # 24: 수익률 첨도 sym_b
        calc_adx(data, sym_a, 14),           # 25: ADX sym_a
        calc_adx(data, sym_b, 14),           # 26: ADX sym_b
        data["SPY_RET_20D"],                 # 27: 시장 레짐 프록시
    ])
    return state
```

### CVaR과 불확실성을 활용한 사이징

```python
# 에이전트에서 행동을 얻은 후
cvar_5pct = qrdqn_agent.cvar(state, action, alpha=0.05)
uncertainty = qrdqn_agent.uncertainty(state, action)

# CVaR 기반 사이징 (이전 포스트 참조)
if cvar_5pct < -0.15:  # 거부 임계값
    skip_trade = True
elif cvar_5pct < -0.05:  # 타겟 임계값
    size_mult = max(0.2, 1.0 - (-0.05 - cvar_5pct) / 0.10)
else:
    size_mult = 1.0

# 불확실성 할인
size_mult *= max(0.2, 1.0 - uncertainty / 2.0)
```

---

## 6. 톰슨 샘플링 밴딧

마지막 계층: 19개 섹터 그룹 중 실제로 어떤 것을 거래해야 하는가?
모든 그룹이 항상 수익성 있는 신호를 만들지는 않는다.

### 아이디어

각 그룹은 **밴딧 팔**이다. 각 팔의 성공 확률을 베타 분포로 모델링한다.
거래 후 사후 분포를 업데이트한다:

```
거래 PnL > 0  ->  보상 = 1  ->  alpha += 1
거래 PnL <= 0 ->  보상 = 0  ->  beta  += 1
```

각 타임스텝에서 각 팔의 `Beta(alpha, beta)`에서 샘플링하고, 가장 높은
샘플을 가진 상위 K개 그룹을 거래한다.

```python
class ThompsonSamplingBandit:
    def __init__(self, arms: list[str], top_k: int = 5):
        self.arms = arms
        self.top_k = top_k
        # 사전분포: Beta(1, 1) = 균등 분포
        self.alpha = {arm: 1.0 for arm in arms}
        self.beta  = {arm: 1.0 for arm in arms}

    def select_arms(self) -> list[str]:
        """각 팔의 사후 분포에서 샘플링하고 상위 k개를 선택."""
        samples = {}
        for arm in self.arms:
            samples[arm] = np.random.beta(self.alpha[arm], self.beta[arm])
        ranked = sorted(samples, key=samples.get, reverse=True)
        return ranked[:self.top_k]

    def update(self, arm: str, reward: float):
        """거래 결과로 사후 분포 업데이트."""
        if reward > 0:
            self.alpha[arm] += 1.0
        else:
            self.beta[arm] += 1.0

    def stats(self) -> dict:
        """각 팔의 사후 평균과 신뢰도 반환."""
        result = {}
        for arm in self.arms:
            a, b = self.alpha[arm], self.beta[arm]
            result[arm] = {
                "mean": a / (a + b),
                "std": np.sqrt(a * b / ((a+b)**2 * (a+b+1))),
                "trades": int(a + b - 2),
            }
        return result
```

### 왜 엡실론-그리디나 UCB가 아닌 톰슨 샘플링인가?

- **엡실론-그리디**는 균등하게 탐색한다 — 명확히 나쁜 팔에 거래를 낭비한다.
- **UCB**는 탐색 상수 튜닝이 필요하고 결정적이다 — 비정상적 환경(금융 시장)
  에서는 확률적 탐색이 필요하다.
- **톰슨 샘플링**은 사후 분포 샘플링을 통해 자연스럽게 탐색/활용 균형을
  맞춘다. 관측이 적은 팔은 넓은 사후 분포(높은 분산 샘플)를 가져 탐색되고,
  관측이 많은 팔은 진정한 승률로 수렴한다.

### 학습된 팔 품질 (275일 OOS 이후)

```
그룹            alpha    beta   평균    표준편차  거래수
────────────    ─────    ────   ─────   ─────   ──────
Tech_0           68       54    0.558   0.045     120
Semicon_0        59       48    0.551   0.048     105
Software_0       52       44    0.542   0.051      94
Comm_0           48       42    0.533   0.053      88
Finance_0        55       50    0.524   0.049     103
Consumer_0       47       44    0.516   0.052      89
Industrial_0     43       42    0.506   0.053      83
Tech_1           39       39    0.500   0.057      76
Consumer_1       36       37    0.493   0.058      71
Material_0       31       33    0.484   0.063      62
RealEstate_0     28       31    0.475   0.065      57
Finance_1        30       34    0.469   0.063      62
Utility_0        25       30    0.455   0.067      53
Industrial_1     24       30    0.444   0.068      52
Energy_0         27       35    0.435   0.065      60
Comm_1           22       30    0.423   0.069      50
Biotech_0        20       30    0.400   0.070      48
Health_1         18       29    0.383   0.071      45
Health_0         18       30    0.375   0.070      46
```

Tech_0의 사후 평균이 가장 높고(0.558) — 횡보 레짐에서 테크 페어가 QR-DQN에
가장 수익성이 높다. Health_0이 가장 낮다(0.375). 밴딧은 자동으로 Health에
대한 배분을 줄이고 Tech/Semicon에 대한 배분을 시간이 지남에 따라 늘린다.

---

## 7. 전체 통합

일일 루프:

```python
def daily_ensemble_step(date, price_data, sector_groups, regime_detectors,
                         qrdqn_agent, bandit, portfolio):
    # 1. 톰슨 샘플링으로 상위 K개 그룹 선택
    active_groups = bandit.select_arms()  # 상위 5개

    all_signals = []
    for group_name in active_groups:
        symbols = sector_groups[group_name]
        detector = regime_detectors[group_name]

        # 2. 현재 레짐 감지
        group_returns = compute_group_returns(symbols, price_data)
        regime = detector.predict_regime(group_returns)

        # 3. 레짐 조건 전략으로 디스패치
        if regime == "Bull":
            signals = bull_strategy(symbols, price_data)
        elif regime == "Sideways":
            try:
                signals = sideways_strategy(symbols, price_data, qrdqn_agent)
            except ModelError:
                signals = zscore_fallback_batch(symbols, price_data)
        elif regime == "Bear":
            signals = bear_strategy(symbols, price_data)

        for s in signals:
            s.group = group_name
            s.regime = regime
        all_signals.extend(signals)

    # 4. 신호 실행 및 PnL 기록
    for signal in all_signals:
        pnl = portfolio.execute(signal)
        bandit.update(signal.group, pnl)
```

---

## 8. 백테스트 결과

### 설정

```
기간:           2025-03-15 ~ 2025-12-15 (275 거래일)
유니버스:       450개 심볼, 19개 GICS 그룹
초기 자본:      1,000,000 USD
최대 포지션:    동시 20개
포지션 사이징:  CVaR 스케일링, 최대 포지션당 5%
슬리피지:       편도 5 bps
수수료:         편도 1 bp
```

### 자본 곡선 (ASCII)

```
포트폴리오 NAV (100으로 정규화)
 122 |                                                        *****
 120 |                                                   ****
 118 |                                              *****
 116 |                                         ****
 114 |                                    ****
 112 |                               ****
 110 |                          *****
 108 |                     ****
 106 |                *****
 104 |           ****
 102 |      *****
 100 |*****          SPY (전 기간 ~100으로 보합)
  98 |----+----+----+----+----+----+----+----+----+----+----+
     3월  4월  5월  6월  7월  8월  9월 10월 11월 12월
     2025
```

### 요약 통계

```
지표                      앙상블       SPY B&H     QR-DQN 단독
────────────────────      ────────     ───────     ───────────
총 수익률                 +20.80%        0.0%        +8.12%
연환산 수익률             +28.54%        0.0%       +11.14%
Sharpe 비율                 1.97         0.00          1.12
Sortino 비율                2.84         0.00          1.48
최대 낙폭                  4.93%          -           7.21%
승률                       56.1%          -           52.3%
평균 이익/손실 비율         1.42          -            1.28
수익 팩터                   1.82          -            1.40
총 거래 수                1,847          -             612
평균 보유 기간            3.2일          -           4.1일
```

### 월별 분석

```
월          수익률   거래수   승률    Sharpe   레짐 비율 (상/횡/하)
────────    ──────   ──────   ────    ──────   ──────────────────
2025-03*    +1.12%       89   54.0%    1.45    30% / 55% / 15%
2025-04     +2.34%      198   57.1%    2.21    25% / 60% / 15%
2025-05     +2.58%      215   58.6%    2.44    20% / 65% / 15%
2025-06     +1.89%      192   55.2%    1.78    35% / 45% / 20%
2025-07     +2.71%      224   59.4%    2.62    15% / 70% / 15%
2025-08     +1.45%      178   52.8%    1.32    40% / 35% / 25%
2025-09     +2.12%      201   56.7%    2.05    25% / 55% / 20%
2025-10     +2.88%      218   58.3%    2.71    20% / 65% / 15%
2025-11     +1.92%      186   54.8%    1.83    30% / 50% / 20%
2025-12*    +1.79%      146   55.5%    1.89    25% / 60% / 15%

* 불완전 월
```

### 핵심 관찰

1. **수익이 시간에 따라 선형적으로 증가한다.** 월별 수익률이 일관적(1.1%-2.9%)
   이며 앞쪽에 치우치지 않는다. 과적합이 아니라는 증거다.

2. **승률은 보통(56.1%)이지만 평균 이익/손실 비율(1.42)이 핵심이다.** RL
   시스템은 자주 맞을 필요 없이, 맞을 때 크게 맞으면 된다.

3. **앙상블이 QR-DQN 단독 대비 수익률 2.5배.** 레짐 감지 계층이 페어
   트레이딩이 실패하는 레짐(상승 모멘텀, 하락 폭락)에서의 배치를 방지한다.

4. **MDD 4.93%는 QR-DQN 단독(7.21%)의 절반 수준.** 하락 전략과 CVaR
   사이징이 의도대로 작동한다.

5. **횡보 레짐 우세(50-70%)는 예상된 결과.** 시장의 대부분은 대부분의 시간에
   레인지 바운드다. 앙상블은 이 구조적 현실에서 수익을 낸다.

---

## 9. 배운 교훈

**1. 작고 고품질 데이터셋이 크고 노이즈 많은 것을 이긴다.**
44개 환경의 R6이 213개 환경의 R10을 2배 이겼다. 섹터 그룹화는 450개 심볼
유니버스를 19개의 R6 크기 문제로 되돌린다.

**2. 레짐 감지는 기본이다.**
HMM 없이 QR-DQN 모델은 페어 트레이딩이 구조적으로 실패하는 상승/하락
레짐에도 배치된다. HMM이 문지기 역할을 한다.

**3. 톰슨 샘플링은 비정상적 환경에 적합한 밴딧이다.**
섹터는 수익성에서 순환한다. TS는 최근 저성과 그룹의 탐색을 자연스럽게
늘리고(사후 분포가 넓어짐), 현재 작동하는 그룹에 활용을 집중한다.

**4. 폴백은 선택이 아니다.**
z-score 폴백이 ~8% 발동한다(모델 로딩 실패, 피처 변경 후 차원 불일치, NaN
상태). 이것 없이는 최고의 레짐(횡보)에서 놓치는 거래가 된다.

**5. 앙상블은 RL 구성 요소를 더 가치 있게 만든다.**
QR-DQN을 작동하는 곳에서만 배치함으로써(고품질 섹터 그룹의 횡보 레짐),
유효 승률이 52.3%(단독)에서 58.6%(앙상블, 횡보 월)로 올라간다.

---

## 10. 다음 단계

- **온라인 HMM 업데이트** — 현재 주간 재적합, 일일 증분 업데이트 원함
- **그룹별 QR-DQN** — 공유 모델 대신 섹터 그룹별 별도 모델 훈련
- **다중 팔 컨텍스트 밴딧** — 톰슨 샘플링을 매크로 피처(VIX, 금리 곡선)에
  조건부인 LinUCB로 교체
- **라이브 페이퍼 트레이딩** — 실전 투입 전 IBKR 페이퍼 계정에서 90일 배치

코드는 `app/trading/rl/ensemble/`에, 백테스트 러너는
`scripts/run_ensemble_backtest.py`에 있다.

---

## 참고문헌

- Dabney et al., "Distributional Reinforcement Learning with Quantile Regression," AAAI 2018
- Rabiner, "A Tutorial on Hidden Markov Models," IEEE 1989
- Thompson, "On the Likelihood that One Unknown Probability Exceeds Another," Biometrika 1933
- Chapelle & Li, "An Empirical Evaluation of Thompson Sampling," NeurIPS 2011
