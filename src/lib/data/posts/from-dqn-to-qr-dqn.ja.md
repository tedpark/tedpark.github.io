---
title: "DQN から QR-DQN へ — ペアトレーディングのテールリスクのための分布型 RL"
subtitle: "期待 Q 値がなぜ不十分なのか、そして 51 個の分位数が SAC では得られないものを何をもたらすか。"
date: "2026-04-16"
tags: ["強化学習", "分布型RL", "クオンツファイナンス", "PyTorch", "CVaR"]
summary: "SAC と PPO は期待リターンしか学習しない — 安定した +0.2 と負のファットテールを持つ +0.2 平均を区別できない。QR-DQN は行動ごとのリターン分布全体を学習するため、CVaR / Expected Shortfall が自然に導出される。ペアトレーディングスタックに実装し、実際の CVaR カラムを持つ 3-way SAC vs PPO vs QR-DQN ベンチマークを実行した。"
lang: ja
---

> **TL;DR** QR-DQN は行動ごとにリターン分布の 51 個の分位数を学習する。CVaR₅% がワンライナーで出てくる。SAC と PPO は期待値しか学習しないため CVaR カラムを生成できない。

## 期待 Q 値の限界

SAC と PPO を含むほとんどの RL アルゴリズムは以下を学習する:

```
Q(s, a) = E[ sum(γ^t * r_t) | s₀=s, a₀=a ]
```

これはスカラー値だ。期待累積報酬。

ペアトレーディングでこれがなぜ問題なのか考えてみよう。2 つの戦略を想像してほしい:
- **戦略 A**: 常に +0.2 のリターン（分散 = 0）
- **戦略 B**: 70% の確率で +0.5、30% の確率で -0.6（期待値 = 0.5×0.7 - 0.6×0.3 = 0.17）

期待 Q 値だけを見ると戦略 A がわずかに良い。しかしリスク管理の観点では、戦略 B の 30% 確率の -0.6 はレバレッジを使った実取引では口座を吹き飛ばす可能性がある。

SAC と PPO はこの 2 つの戦略を区別する数値を提供できない。

## QR-DQN: 分位回帰 DQN

QR-DQN（Dabney et al. 2018）はスカラーの Q 値の代わりにリターン分布を学習する。N 個の分位数（τ₁, τ₂, ..., τ_N）を使って分布を近似する。

```python
class QRDQNNetwork(nn.Module):
    """
    N 個の分位数で行動ごとのリターン分布を学習。
    出力: (batch, num_actions, n_quantiles)
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
        """分位数の平均 = 期待 Q 値"""
        return self.forward(state).mean(dim=-1)  # (batch, action_dim)
```

## 分位回帰損失

標準の TD 誤差の代わりに分位回帰損失を使用する:

```python
def quantile_regression_loss(
    quantiles: torch.Tensor,        # (batch, n_actions, n_quantiles)
    target_quantiles: torch.Tensor, # (batch, n_quantiles)
    taus: torch.Tensor,             # (n_quantiles,)
) -> torch.Tensor:
    """
    Huber 分位回帰損失 (QR-DQN 論文 eq. 10)。
    """
    batch, n_actions, n_q = quantiles.shape
    
    pred = quantiles
    tgt = target_quantiles.unsqueeze(1)  # (batch, 1, n_q)
    
    # pairwise TD 誤差: (batch, n_q_pred, n_q_tgt)
    td = tgt - pred.transpose(1, 2)
    
    huber = torch.where(td.abs() <= 1.0, 0.5 * td.pow(2), td.abs() - 0.5)
    
    taus_exp = taus.unsqueeze(0).unsqueeze(0)  # (1, 1, n_q)
    indicator = (td.detach() < 0).float()
    weights = (taus_exp - indicator).abs()
    
    loss = (weights * huber).mean(dim=-1).sum(dim=-1).mean()
    return loss
```

## CVaR の計算: ワンライナー

これが核心だ。51 個の分位数があれば CVaR₅% は:

```python
def cvar(quantiles: np.ndarray, alpha: float = 0.05) -> float:
    """
    CVaR_alpha = 下位 alpha 分位数の平均。
    quantiles: ソート済みのリターン分位数配列 (n_quantiles,)
    """
    cutoff = int(alpha * len(quantiles))
    return quantiles[:cutoff].mean()

# 使用例:
with torch.no_grad():
    q_dist = model(state_tensor)  # (1, n_actions, 51)
    best_action = q_dist.mean(dim=-1).argmax(dim=-1).item()
    action_dist = q_dist[0, best_action].cpu().numpy()
    
    expected_return = action_dist.mean()
    cvar_5 = cvar(action_dist, alpha=0.05)
```

SAC や PPO ではこれが不可能だ。期待値しかなく分布がないから。

## 3-Way ベンチマーク

| アルゴリズム | 平均報酬 | CVaR₅% | ウォールタイム |
|------------|--------|-------|------------|
| SAC | +0.191 | N/A | 28.3s |
| PPO | +0.214 | N/A | 0.9s |
| QR-DQN | +0.187 | -0.043 | 4.2s |

注目すべき点:

1. **QR-DQN の期待報酬は SAC/PPO と同程度だ。** 分布を学習しても期待値は大きく変わらない。
2. **CVaR₅% は QR-DQN のみが提供できる。** -0.043 という数値は「最悪 5% シナリオで平均 -4.3% を失う」を意味する。これをポジションサイジングに活用できる。
3. **速度は SAC より速く PPO より遅い。** リプレイバッファがあるため PPO より遅いが、twin critic がないため SAC より速い。

## ペアトレーディングでの活用

CVaR カラムがあれば 2 つの方法で活用できる:

**1. ポジションサイズの調整:**
```python
def position_size(expected_return: float, cvar: float, 
                  cvar_floor: float = -0.05) -> float:
    """CVaR が floor より悪ければポジションを縮小。"""
    if cvar < cvar_floor:
        scale = max(0.0, (cvar - cvar_floor * 2) / (-cvar_floor))
        return scale
    return 1.0
```

**2. 取引の拒否:**
```python
def should_trade(cvar: float, veto_threshold: float = -0.10) -> bool:
    """CVaR が悪すぎる場合は取引しない。"""
    return cvar > veto_threshold
```

## まとめ

SAC は 4 年間うまく機能してきた。しかし「この取引の最悪 5% シナリオはいくらか？」という質問には答えられない。QR-DQN はこの質問に答える。期待報酬を犠牲にせずに。次の投稿では、この CVaR の数値を実際のポジションサイジングにどう接続するかを扱う。
