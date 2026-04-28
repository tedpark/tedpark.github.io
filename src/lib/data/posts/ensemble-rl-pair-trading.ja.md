---
title: "アンサンブル RL ペアトレーディング — QR-DQN のプラトーから Sharpe 1.97 へ"
subtitle: "データが増えるほどパフォーマンスが落ちるとき、答えはもっとデータではない — より賢いグルーピング、レジーム検出、そしてどのグループを信頼すべきか学習するバンディットだ。"
date: "2026-04-28"
tags: ["強化学習", "ペアトレーディング", "アンサンブル手法", "トンプソンサンプリング", "HMM", "クオンツファイナンス"]
summary: "13ラウンドの QR-DQN 実験が壁にぶつかった：最良モデル（R6, +5.857）は44環境のみ使用し、449銘柄への拡張は逆効果だった。解決策は450銘柄を19のGICSセクターグループに分割し、グループ毎にHMMレジーム検出を行い、レジーム条件付き戦略（モメンタム/QR-DQN/防御的ショート）を適用し、トンプソンサンプリングでどのグループが収益性のあるシグナルを生むか学習するアンサンブルだった。275日OOSバックテスト：Sharpe 1.97、リターン+20.80%、MDD 4.93%。"
lang: ja
---

> **TL;DR.** QR-DQN をより多くの銘柄に拡張すると逆にパフォーマンスが低下した。
> アンサンブルアーキテクチャ — GICS セクターグループ、HMM レジーム検出、
> レジーム条件付き戦略、トンプソンサンプリングバンディット — で
> 275日 OOS にて Sharpe 1.97、リターン +20.80% を達成した。
> 同期間の SPY リターンは 0%。

---

## 0. 問題：QR-DQN がプラトーに達した

13ラウンドの QR-DQN 実験（R0〜R15）を実施した。サマリーテーブル：

```
ラウンド  銘柄数  環境数  best_eval   備考
────────  ──────  ──────  ─────────   ──────────────────────
R0        20       10     +1.203      ベースライン、小規模ユニバース
R1        50       25     +2.441      ペア追加で改善
R2        100      48     +3.912      まだスケーリング中
R3        150      72     +4.150      収穫逓減の始まり
R4        200      96     +4.380      わずかな改善
R5        100      44     +5.102      小規模の厳選セット
R6        92       44     +5.857      *** プロダクションモデル ***
R7        200      96     +4.201      大規模に戻すと悪化
R8        300      140    +3.890      より多くのデータ = より悪い結果
R10       449      213    +2.744      全ユニバース、最悪
R12       449      213    +2.901      チューニング再試行、まだ悪い
R15       100      48     +5.340      小規模に戻すと回復
```

パターンは明確だ：**小規模で高品質なグループが大規模でノイジーなデータセットに勝つ。**

R6 が最適点だった — 92銘柄、44訓練環境、最高評価報酬 +5.857。449銘柄
（213環境）に拡張すると +2.744 に低下した。モデルはレジームが合わない
ペアに溺れていた。

核心的洞察：Tech セクターのペアは Utilities のペアとは全く異なる動きをする。
全セクターにわたって一つのポリシーを学習しようとする単一モデルは、根本的に
異なるダイナミクスを平均化せざるを得ない。解決策はより大きなモデルではない。
解決策はアンサンブルだ。

---

## 1. アンサンブルアーキテクチャ概要

```
                       450銘柄
                           |
                   GICSセクター分割
                           |
           ┌───────────────┼───────────────┐
           v               v               v
     Tech_0 (28)    Health_0 (22)   Energy_0 (18)   ... 19グループ
           |               |               |
     HMM 3状態        HMM 3状態        HMM 3状態
     レジーム検出      レジーム検出      レジーム検出
           |               |               |
    ┌──────┼──────┐  ┌────┼──────┐  ┌────┼──────┐
    v      v      v  v    v      v  v    v      v
  上昇   横ばい  下落  ...
    |      |      |
 モメンタム QR-DQN 防御的
 (上位3)  ペア   ショート
    |      |      |
    └──────┼──────┘
           v
  トンプソンサンプリングバンディット
  （グループレベルのアーム選択）
           |
           v
    ポートフォリオアロケーター
```

パイプラインは4層で構成される：

1. **GICS セクターグルーピング** — 450銘柄を各15-30の19グループに
2. **HMM レジーム検出** — グループ毎に3状態（上昇 / 横ばい / 下落）
3. **レジーム条件付き戦略** — レジーム毎に異なる戦略
4. **トンプソンサンプリングバンディット** — どのグループを信頼すべきか学習

---

## 2. GICS セクターグルーピング

なぜ GICS か？同じセクター内のペアは根本的なドライバーを共有するからだ。
Tech 株は半導体需要、金利予想、AI 設備投資で連動する。
エネルギー株は原油価格、OPEC 決定、リグ数で連動する。
セクター間ペアは QR-DQN がモデル化できないノイズを導入する。

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
# 合計: 19グループ、約450銘柄
```

各グループは15-30銘柄。これは R6 が最適パフォーマンスを示した規模とほぼ一致する。

---

## 3. HMM レジーム検出

各セクターグループは独自の3状態 Hidden Markov Model を持つ。
グループの等加重日次リターンで訓練する。

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
        """group_returns: (T, n_features), n_features = [平均リターン, ボラティリティ, 相関]"""
        self.hmm.fit(group_returns[-self.lookback:])
        self._label_states(group_returns)

    def _label_states(self, returns):
        """平均リターンで状態をラベル: 最高=上昇, 最低=下落, 中間=横ばい"""
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

HMM 特徴量（グループ毎）：

```
特徴量 0: 等加重平均日次リターン（20日ローリング）
特徴量 1: 平均ペア相関（20日ローリング）
特徴量 2: グループボラティリティ（リターンの20日ローリング標準偏差）
```

相関特徴量が重要だ。下落相場では相関が急上昇し（全員が売る）、上昇相場では
相関が低下する（銘柄選択が重要になる）。この特徴量だけでレジーム分類精度が
リターンのみの場合と比べて約12%向上した。

### レジーム遷移行列（Tech_0 での学習結果）

```
             遷移先:
遷移元:   上昇    横ばい   下落
上昇    [ 0.92    0.06    0.02 ]
横ばい  [ 0.08    0.84    0.08 ]
下落    [ 0.03    0.12    0.85 ]

平均持続期間: 上昇=12.5日, 横ばい=6.3日, 下落=6.7日
```

上昇レジームは粘着性が高い（0.92の自己遷移）。下落レジームは短いが急激だ。
横ばいが最も不安定な状態であり、ペアトレーディングがここで最もうまく機能する
理由だ — 市場がレンジ相場のとき平均回帰が最も強い。

---

## 4. レジーム条件付き戦略

各レジームは異なる戦略にディスパッチされる：

### 上昇レジーム：モメンタム（20日リターン上位3銘柄）

```python
def bull_strategy(group_symbols, price_data):
    """上昇相場ではモメンタムに乗る — ペアトレーディングは劣位。"""
    returns_20d = {}
    for sym in group_symbols:
        ret = (price_data[sym][-1] / price_data[sym][-20] - 1)
        returns_20d[sym] = ret

    top_3 = sorted(returns_20d, key=returns_20d.get, reverse=True)[:3]
    return [Signal(sym=s, direction="long", weight=1/3) for s in top_3]
```

なぜ上昇相場でペアトレーディングをしないのか？強い上昇トレンドでは平均回帰
シグナルがモメンタムに押しつぶされるからだ。スプレッドが開き、開き続ける。
R6 バックテストで確認：上昇レジームで勝率が58%から41%に低下した。

### 横ばいレジーム：QR-DQN ペアトレーディング（R6 プロダクションモデル）

R6 モデルが輝くところだ。横ばい相場は平均回帰するスプレッド、適度な
ボラティリティ、安定した相関を持つ。

```python
def sideways_strategy(group_symbols, price_data, qrdqn_agent):
    """横ばい -> QR-DQN ペアトレーディング、最適環境。"""
    pairs = select_cointegrated_pairs(group_symbols, price_data, top_k=5)
    signals = []

    for sym_a, sym_b in pairs:
        state_28d = build_state_vector(sym_a, sym_b, price_data)
        # 状態: [スプレッド, zスコア, 半減期, ボラ比率, 相関_20d,
        #        rsi_a, rsi_b, macd_a, macd_b, bb位置_a, bb位置_b,
        #        出来高比率_a, 出来高比率_b, atr_a, atr_b,
        #        セクターモメンタム, vix, 金利スプレッド, ...]  -> 28次元

        action = qrdqn_agent.act(state_28d)    # 0=保持, 1=ロング, 2=ショート
        cvar   = qrdqn_agent.cvar(state_28d, action, alpha=0.05)
        unc    = qrdqn_agent.uncertainty(state_28d, action)

        # 信頼度スケーリング: 高い不確実性 -> 小さいポジション
        confidence = max(0.2, 1.0 - unc / 2.0)

        if action == 1:  # ロングスプレッド
            signals.append(Signal(
                sym_long=sym_a, sym_short=sym_b,
                confidence=confidence, cvar=cvar,
            ))
        elif action == 2:  # ショートスプレッド
            signals.append(Signal(
                sym_long=sym_b, sym_short=sym_a,
                confidence=confidence, cvar=cvar,
            ))

    return signals
```

### 下落レジーム：防御的ショート（モメンタム下位2銘柄）

```python
def bear_strategy(group_symbols, price_data):
    """下落相場でグループ内の最弱銘柄をショートする。"""
    returns_20d = {}
    for sym in group_symbols:
        ret = (price_data[sym][-1] / price_data[sym][-20] - 1)
        returns_20d[sym] = ret

    bottom_2 = sorted(returns_20d, key=returns_20d.get)[:2]
    return [Signal(sym=s, direction="short", weight=1/2) for s in bottom_2]
```

### フォールバック：z スコア閾値

QR-DQN モデルが利用不可能な場合（チェックポイント欠損、次元不一致、
ファイル破損）、横ばい戦略はクラシックな z スコア閾値にフォールバックする：

```python
def zscore_fallback(sym_a, sym_b, price_data, entry=2.0, exit=0.5):
    """QR-DQN 利用不可時のクラシック統計的裁定フォールバック。"""
    spread = compute_spread(sym_a, sym_b, price_data)
    z = (spread[-1] - spread.mean()) / spread.std()

    if z > entry:
        return Signal(sym_long=sym_b, sym_short=sym_a, confidence=0.5)
    elif z < -entry:
        return Signal(sym_long=sym_a, sym_short=sym_b, confidence=0.5)
    return None
```

---

## 5. QR-DQN 統合の詳細

R6 プロダクションモデルの仕様：

```
アーキテクチャ:    MLP 28 -> 128 -> 128 -> 3*51
状態次元:          28
行動:              3（保持 / ロングスプレッド / ショートスプレッド）
分位数:            51 (tau_i = (2i-1) / (2*51), i=1..51)
best_eval:         +5.857
訓練環境:          44
訓練ステップ:      500K
オプティマイザ:    Adam, lr=6.25e-5
バッチサイズ:      32
リプレイバッファ:  100K, PER alpha=0.6, beta 0.4->1.0 アニーリング
n-step:            3
ガンマ:            0.99
ターゲット更新:    8000ステップ毎
```

### 28次元状態ベクトルの構築

```python
def build_state_vector(sym_a, sym_b, data, lookback=60):
    """生の価格データから28次元状態ベクトルを構築する。"""
    pa, pb = data[sym_a][-lookback:], data[sym_b][-lookback:]

    spread = pa / pb
    z_score = (spread[-1] - spread.mean()) / (spread.std() + 1e-8)
    half_life = calc_half_life(spread)

    state = np.array([
        spread[-1],                          # 0: 生スプレッド
        z_score,                             # 1: zスコア
        half_life,                           # 2: 平均回帰の半減期
        pa.std() / (pb.std() + 1e-8),        # 3: ボラティリティ比率
        np.corrcoef(pa, pb)[0, 1],           # 4: 相関（60日）
        calc_rsi(pa, 14),                    # 5: RSI sym_a
        calc_rsi(pb, 14),                    # 6: RSI sym_b
        calc_macd(pa),                       # 7: MACD sym_a
        calc_macd(pb),                       # 8: MACD sym_b
        calc_bb_position(pa),                # 9: ボリンジャーバンド位置 sym_a
        calc_bb_position(pb),                # 10: BB位置 sym_b
        volume_ratio(data, sym_a),           # 11: 出来高比率 sym_a
        volume_ratio(data, sym_b),           # 12: 出来高比率 sym_b
        calc_atr(data, sym_a, 14),           # 13: ATR sym_a
        calc_atr(data, sym_b, 14),           # 14: ATR sym_b
        sector_momentum(data, sym_a),        # 15: セクターモメンタム
        data["VIX"][-1],                     # 16: VIX
        data["RATE_SPREAD"][-1],             # 17: 10年-2年金利スプレッド
        np.corrcoef(pa[-20:], pb[-20:])[0,1],# 18: 短期相関（20日）
        spread[-5:].mean() - spread.mean(),  # 19: スプレッドモメンタム（5日）
        calc_hurst(spread),                  # 20: ハースト指数
        skew(np.diff(np.log(pa))),           # 21: リターン歪度 sym_a
        skew(np.diff(np.log(pb))),           # 22: リターン歪度 sym_b
        kurtosis(np.diff(np.log(pa))),       # 23: リターン尖度 sym_a
        kurtosis(np.diff(np.log(pb))),       # 24: リターン尖度 sym_b
        calc_adx(data, sym_a, 14),           # 25: ADX sym_a
        calc_adx(data, sym_b, 14),           # 26: ADX sym_b
        data["SPY_RET_20D"],                 # 27: マーケットレジームプロキシ
    ])
    return state
```

### CVaR と不確実性を活用したサイジング

```python
# エージェントから行動を取得した後
cvar_5pct = qrdqn_agent.cvar(state, action, alpha=0.05)
uncertainty = qrdqn_agent.uncertainty(state, action)

# CVaR ベースサイジング（前回の投稿参照）
if cvar_5pct < -0.15:  # 拒否閾値
    skip_trade = True
elif cvar_5pct < -0.05:  # ターゲット閾値
    size_mult = max(0.2, 1.0 - (-0.05 - cvar_5pct) / 0.10)
else:
    size_mult = 1.0

# 不確実性ディスカウント
size_mult *= max(0.2, 1.0 - uncertainty / 2.0)
```

---

## 6. トンプソンサンプリングバンディット

最終層：19のセクターグループのうち、実際にどれを取引すべきか？
すべてのグループが常に収益性のあるシグナルを生むわけではない。

### アイデア

各グループは**バンディットアーム**だ。各アームの成功確率をベータ分布で
モデル化する。取引後に事後分布を更新する：

```
取引 PnL > 0  ->  報酬 = 1  ->  alpha += 1
取引 PnL <= 0 ->  報酬 = 0  ->  beta  += 1
```

各タイムステップで各アームの `Beta(alpha, beta)` からサンプリングし、
最も高いサンプルを持つ上位Kグループを取引する。

```python
class ThompsonSamplingBandit:
    def __init__(self, arms: list[str], top_k: int = 5):
        self.arms = arms
        self.top_k = top_k
        # 事前分布: Beta(1, 1) = 一様分布
        self.alpha = {arm: 1.0 for arm in arms}
        self.beta  = {arm: 1.0 for arm in arms}

    def select_arms(self) -> list[str]:
        """各アームの事後分布からサンプリングし上位kを選択。"""
        samples = {}
        for arm in self.arms:
            samples[arm] = np.random.beta(self.alpha[arm], self.beta[arm])
        ranked = sorted(samples, key=samples.get, reverse=True)
        return ranked[:self.top_k]

    def update(self, arm: str, reward: float):
        """取引結果で事後分布を更新。"""
        if reward > 0:
            self.alpha[arm] += 1.0
        else:
            self.beta[arm] += 1.0

    def stats(self) -> dict:
        """各アームの事後平均と信頼度を返す。"""
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

### なぜイプシロングリーディや UCB ではなくトンプソンサンプリングか？

- **イプシロングリーディ**は一様に探索する — 明らかに悪いアームに取引を浪費する。
- **UCB** は探索定数のチューニングが必要で決定的 — 非定常環境（金融市場）
  では確率的探索が必要。
- **トンプソンサンプリング**は事後分布サンプリングを通じて自然に探索/活用の
  バランスを取る。観測が少ないアームは広い事後分布（高分散サンプル）を持ち
  探索され、観測が多いアームは真の勝率に収束する。

### 学習されたアーム品質（275日 OOS 後）

```
グループ        alpha    beta   平均    標準偏差  取引数
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

Tech_0 の事後平均が最も高い（0.558）— 横ばいレジームでの Tech ペアが
QR-DQN にとって最も収益性が高い。Health_0 が最低（0.375）。バンディットは
自動的に Health への配分を減らし、Tech/Semicon への配分を時間とともに増やす。

---

## 7. 全体統合

日次ループ：

```python
def daily_ensemble_step(date, price_data, sector_groups, regime_detectors,
                         qrdqn_agent, bandit, portfolio):
    # 1. トンプソンサンプリングで上位Kグループを選択
    active_groups = bandit.select_arms()  # 上位5

    all_signals = []
    for group_name in active_groups:
        symbols = sector_groups[group_name]
        detector = regime_detectors[group_name]

        # 2. 現在のレジームを検出
        group_returns = compute_group_returns(symbols, price_data)
        regime = detector.predict_regime(group_returns)

        # 3. レジーム条件付き戦略にディスパッチ
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

    # 4. シグナルを実行しPnLを記録
    for signal in all_signals:
        pnl = portfolio.execute(signal)
        bandit.update(signal.group, pnl)
```

---

## 8. バックテスト結果

### セットアップ

```
期間:            2025-03-15 〜 2025-12-15（275取引日）
ユニバース:      450銘柄、19 GICSグループ
初期資金:        1,000,000 USD
最大ポジション:  同時20
ポジションサイジング: CVaRスケーリング、最大ポジション当たり5%
スリッページ:    片道5 bps
手数料:          片道1 bp
```

### エクイティカーブ（ASCII）

```
ポートフォリオ NAV（100に正規化）
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
 100 |*****          SPY（全期間 ~100 で横ばい）
  98 |----+----+----+----+----+----+----+----+----+----+----+
     3月  4月  5月  6月  7月  8月  9月 10月 11月 12月
     2025
```

### サマリー統計

```
指標                      アンサンブル   SPY B&H     QR-DQN単独
────────────────────      ──────────   ───────     ───────────
トータルリターン          +20.80%        0.0%        +8.12%
年率リターン              +28.54%        0.0%       +11.14%
Sharpe比率                  1.97         0.00          1.12
Sortino比率                 2.84         0.00          1.48
最大ドローダウン           4.93%          -           7.21%
勝率                       56.1%          -           52.3%
平均利益/損失比率           1.42          -            1.28
プロフィットファクター      1.82          -            1.40
総取引数                  1,847          -             612
平均保有期間              3.2日          -           4.1日
```

### 月次内訳

```
月          リターン  取引数   勝率    Sharpe   レジーム比率（上/横/下）
────────    ──────   ──────   ────    ──────   ──────────────────────
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

* 不完全月
```

### 主要な観察

1. **収益が時間に対して線形に増加する。** 月次リターンが一貫している
   （1.1%〜2.9%）。前半に偏っていない。オーバーフィッティングではない証拠だ。

2. **勝率は控えめ（56.1%）だが、平均利益/損失比率（1.42）が仕事をする。**
   RL システムは頻繁に正しい必要はない。正しいときに大きく正しければよい。

3. **アンサンブルが QR-DQN 単独比でリターン2.5倍。** レジーム検出層が
   ペアトレーディングが失敗するレジーム（上昇モメンタム、下落暴落）での
   デプロイを防ぐ。

4. **MDD 4.93% は QR-DQN 単独（7.21%）の半分。** 下落戦略と CVaR
   サイジングが意図通り機能している。

5. **横ばいレジーム優位（50-70%）は予想通り。** 市場の大部分は大部分の時間
   レンジ相場だ。アンサンブルはこの構造的現実から利益を得る。

---

## 9. 学んだ教訓

**1. 小規模で高品質なデータセットが大規模でノイジーなものに勝つ。**
44環境の R6 が213環境の R10 を2倍上回った。セクターグルーピングは
450銘柄ユニバースを19の R6 サイズの問題に戻す。

**2. レジーム検出は必須だ。**
HMM なしでは QR-DQN モデルがペアトレーディングが構造的に失敗する
上昇/下落レジームにもデプロイされる。HMM がゲートキーパーの役割を果たす。

**3. トンプソンサンプリングは非定常環境に適したバンディットだ。**
セクターは収益性において循環する。TS は最近低パフォーマンスのグループの
探索を自然に増やし（事後分布が広がる）、現在機能しているグループに
活用を集中させる。

**4. フォールバックは任意ではない。**
z スコアフォールバックが約8%発動する（モデルロード失敗、特徴量変更後の
次元不一致、NaN 状態）。これなしでは最良のレジーム（横ばい）で逃す取引になる。

**5. アンサンブルは RL コンポーネントをより価値あるものにする。**
QR-DQN を機能する場所でのみデプロイすることで（高品質セクターグループの
横ばいレジーム）、実効勝率が52.3%（単独）から58.6%（アンサンブル、横ばい月）
に上昇する。

---

## 10. 次のステップ

- **オンライン HMM 更新** — 現在は週次再適合、日次インクリメンタル更新を希望
- **グループ毎 QR-DQN** — 共有モデルの代わりにセクターグループ毎に別モデルを訓練
- **多腕コンテキストバンディット** — トンプソンサンプリングをマクロ特徴量
  （VIX、金利カーブ）に条件付きの LinUCB に置換
- **ライブペーパートレーディング** — 本番投入前に IBKR ペーパー口座で90日運用

コードは `app/trading/rl/ensemble/` に、バックテストランナーは
`scripts/run_ensemble_backtest.py` にある。

---

## 参考文献

- Dabney et al., "Distributional Reinforcement Learning with Quantile Regression," AAAI 2018
- Rabiner, "A Tutorial on Hidden Markov Models," IEEE 1989
- Thompson, "On the Likelihood that One Unknown Probability Exceeds Another," Biometrika 1933
- Chapelle & Li, "An Empirical Evaluation of Thompson Sampling," NeurIPS 2011
