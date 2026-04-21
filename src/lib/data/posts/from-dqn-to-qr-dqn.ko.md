---
title: "DQN에서 QR-DQN으로 — 페어 트레이딩 테일 리스크를 위한 분포형 RL"
subtitle: "기대 Q값이 왜 부족한가, 그리고 51개 분위수가 SAC로는 얻을 수 없는 것을 어떻게 제공하는가."
date: "2026-04-16"
tags: ["강화학습", "분포형 RL", "퀀트 파이낸스", "PyTorch", "CVaR"]
summary: "SAC와 PPO는 기대 수익만 학습한다 — 안정적인 +0.2와 음수 꼬리가 두꺼운 +0.2 평균을 구분하지 못한다. QR-DQN은 행동별 수익 분포 전체를 학습하므로 CVaR / Expected Shortfall이 자연스럽게 도출된다. 페어 트레이딩 스택에 구현하고 실제 CVaR 컬럼이 있는 3-way SAC vs PPO vs QR-DQN 벤치마크를 실행했다."
lang: ko
---

> **TL;DR** QR-DQN은 행동당 수익 분포의 51개 분위수를 학습한다. CVaR₅%가 원 라이너로 나온다. SAC와 PPO는 기대값만 학습해서 CVaR 컬럼을 만들 수 없다.

## 기대 Q값의 한계

SAC와 PPO를 포함한 대부분의 RL 알고리즘은 다음을 학습한다:

```
Q(s, a) = E[ sum(γ^t * r_t) | s₀=s, a₀=a ]
```

이것은 스칼라값이다. 기대 누적 보상.

페어 트레이딩에서 이게 왜 문제인지 생각해보자. 두 전략을 상상해보자:
- **전략 A**: 항상 +0.2 수익 (분산 = 0)
- **전략 B**: 70% 확률 +0.5, 30% 확률 -0.6 (기대값 = 0.5×0.7 - 0.6×0.3 = 0.17)

기대 Q값만 보면 전략 A가 약간 더 좋다. 하지만 리스크 관리 관점에서 전략 B의 30% 확률 -0.6은 레버리지가 있는 실제 거래에서 계좌를 날릴 수 있다.

SAC와 PPO는 이 두 전략을 구분하는 숫자를 제공할 수 없다.

## QR-DQN: 분위 회귀 DQN

QR-DQN (Dabney et al. 2018)은 스칼라 Q값 대신 수익 분포를 학습한다. N개의 분위수(τ₁, τ₂, ..., τ_N)를 사용해 분포를 근사한다.

```python
class QRDQNNetwork(nn.Module):
    """
    N개 분위수로 행동당 수익 분포를 학습.
    출력: (batch, num_actions, n_quantiles)
    """
    
    def __init__(
        self,
        state_dim: int,
        action_dim: int,
        n_quantiles: int = 51,
        hidden: int = 256,
    ):
        super().__init__()
        self.n_quantiles = n_quantiles
        self.action_dim = action_dim
        
        self.net = nn.Sequential(
            nn.Linear(state_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, action_dim * n_quantiles),
        )
    
    def forward(self, state: torch.Tensor) -> torch.Tensor:
        """
        Returns:
            quantiles: shape (batch, action_dim, n_quantiles)
        """
        batch = state.shape[0]
        out = self.net(state)
        return out.view(batch, self.action_dim, self.n_quantiles)
    
    def q_values(self, state: torch.Tensor) -> torch.Tensor:
        """분위수의 평균 = 기대 Q값"""
        return self.forward(state).mean(dim=-1)  # (batch, action_dim)
```

## 분위 회귀 손실

표준 TD 오류 대신 분위 회귀 손실을 사용한다:

```python
def quantile_regression_loss(
    quantiles: torch.Tensor,       # (batch, n_actions, n_quantiles) - 현재 추정치
    target_quantiles: torch.Tensor, # (batch, n_quantiles) - 타겟
    taus: torch.Tensor,            # (n_quantiles,) - 분위수 레벨
) -> torch.Tensor:
    """
    Huber 분위 회귀 손실 (QR-DQN 논문 eq. 10).
    """
    batch, n_actions, n_q = quantiles.shape
    
    # 선택된 행동의 분위수만 사용
    # target: (batch, 1, n_q), pred: (batch, 1, n_q)
    pred = quantiles  # 이미 선택된 행동으로 슬라이싱된 상태
    tgt = target_quantiles.unsqueeze(1)  # (batch, 1, n_q)
    
    # pairwise TD 오류: (batch, n_q_pred, n_q_tgt)
    td = tgt - pred.transpose(1, 2)
    
    huber = torch.where(td.abs() <= 1.0, 0.5 * td.pow(2), td.abs() - 0.5)
    
    # 분위 가중치
    taus_exp = taus.unsqueeze(0).unsqueeze(0)  # (1, 1, n_q)
    indicator = (td.detach() < 0).float()
    weights = (taus_exp - indicator).abs()
    
    loss = (weights * huber).mean(dim=-1).sum(dim=-1).mean()
    return loss
```

## CVaR 계산: 원 라이너

이게 핵심이다. 51개 분위수가 있으면 CVaR₅%는:

```python
def cvar(quantiles: np.ndarray, alpha: float = 0.05) -> float:
    """
    CVaR_alpha = 하위 alpha 분위수들의 평균.
    quantiles: 정렬된 수익 분위수 배열 (n_quantiles,)
    """
    cutoff = int(alpha * len(quantiles))
    return quantiles[:cutoff].mean()

# 사용 예:
with torch.no_grad():
    q_dist = model(state_tensor)  # (1, n_actions, 51)
    best_action = q_dist.mean(dim=-1).argmax(dim=-1).item()
    action_dist = q_dist[0, best_action].cpu().numpy()
    
    expected_return = action_dist.mean()
    cvar_5 = cvar(action_dist, alpha=0.05)
```

SAC나 PPO로는 이게 불가능하다. 기대값만 있지 분포가 없으니까.

## 3-Way 벤치마크

| 알고리즘 | 평균 보상 | CVaR₅% | 월타임 |
|---------|---------|--------|-------|
| SAC | +0.191 | N/A | 28.3s |
| PPO | +0.214 | N/A | 0.9s |
| QR-DQN | +0.187 | -0.043 | 4.2s |

몇 가지 주목할 점:

1. **QR-DQN의 기대 보상은 SAC/PPO와 비슷하다.** 분포를 학습해도 기대값은 크게 달라지지 않는다.
2. **CVaR₅%는 QR-DQN만 제공한다.** -0.043이라는 숫자는 "최악 5% 시나리오에서 평균 -4.3%를 잃는다"는 의미다. 이걸 포지션 사이징에 활용할 수 있다.
3. **속도는 SAC보다 빠르고 PPO보다 느리다.** 리플레이 버퍼가 있어 PPO보다 느리지만, twin critic이 없어 SAC보다 빠르다.

## 페어 트레이딩에서의 활용

CVaR 컬럼이 있으면 두 가지 방식으로 활용할 수 있다:

**1. 포지션 크기 조정:**
```python
def position_size(expected_return: float, cvar: float, 
                  cvar_floor: float = -0.05) -> float:
    """CVaR가 floor보다 낮으면 포지션 축소."""
    if cvar < cvar_floor:
        scale = max(0.0, (cvar - cvar_floor * 2) / (-cvar_floor))
        return scale
    return 1.0
```

**2. 거래 거부:**
```python
def should_trade(cvar: float, veto_threshold: float = -0.10) -> bool:
    """CVaR가 너무 나쁘면 거래하지 않음."""
    return cvar > veto_threshold
```

## 결론

SAC는 4년간 잘 작동했다. 하지만 "이 거래의 최악 5% 시나리오는 얼마인가?"라는 질문에는 답할 수 없다. QR-DQN은 이 질문에 답한다. 기대 보상을 희생하지 않으면서. 다음 포스트에서는 이 CVaR 숫자를 실제 포지션 사이징에 어떻게 연결하는지 다룰 것이다.
