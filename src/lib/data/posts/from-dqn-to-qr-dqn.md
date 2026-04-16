---
title: "From DQN to QR-DQN — Distributional RL for Tail Risk in Pair Trading"
subtitle: "Why expected Q-values aren't enough, and what 51 quantiles get you that SAC can't."
date: "2026-04-16"
tags: ["Reinforcement Learning", "Distributional RL", "Quantitative Finance", "PyTorch", "CVaR"]
summary: "SAC and PPO learn the expected return only — they cannot tell apart a stable +0.2 from a +0.2 mean with a fat negative tail. QR-DQN learns the full return distribution per action, so CVaR / Expected Shortfall fall out for free. I implemented it in my pair-trading stack and ran a 3-way SAC vs PPO vs QR-DQN benchmark with real CVaR columns."
---

> **TL;DR.** SAC and PPO learn the **expected** Q-value — a single number per action.
> Two policies with the same +0.2 mean can have wildly different tails, and
> expected-Q can't see the difference. **QR-DQN (Dabney 2018)** learns
> **51 quantiles** of the return distribution per action, so **CVaR /
> Expected Shortfall** drop out as a one-liner. I added it to my SAC pair-trading
> stack and ran a 3-way SAC vs PPO vs QR-DQN benchmark — with the CVaR column
> filled in only for QR-DQN, because the others physically cannot produce it.

---

## 0. The question SAC could never answer

I have been building a pair-trading system on SAC ([Haarnoja 2018][sac])
for four years. Twin Q-networks, automatic entropy α, n-step returns, soft
target updates, five pluggable reward schemes — all the standard pieces.
But there is one question I cannot answer with this system:

> "What is the **expected loss in the worst 5% of outcomes** (CVaR₅%) for
> this action?"

SAC learns a single expected Q. It has no notion of distribution. Every
risk metric that hedge-fund reports actually use — CVaR, VaR, Expected
Shortfall — needs the full return distribution. **Distributional RL** is
the family that fixes this. The most practical member is QR-DQN.

[sac]: https://arxiv.org/abs/1801.01290

---

## 1. Where QR-DQN sits in the DQN family tree

QR-DQN is roughly the sixth-generation descendant of DQN. The lineage:

```
DQN (Mnih 2015) — replay buffer + target net + ε-greedy
   ↓ overestimation fix
Double DQN (van Hasselt 2016)
   ↓ split V(s) and A(s,a)
Dueling DQN (Wang 2016)
   ↓ sample important transitions more often
PER (Schaul 2016) — Prioritized Experience Replay
   ↓ ε-greedy → parametric noise
Noisy Networks (Fortunato 2017)
   ↓ learn the distribution, not the mean
C51 (Bellemare 2017) — first distributional RL
   ↓ learn the quantile values themselves
QR-DQN (Dabney 2018) — this post
   ↓ implicit quantiles
IQN (2018) / FQF (2019)

Rainbow (Hessel 2017) = DQN + Double + Dueling + PER + Noisy + C51 + Multi-step
```

My system already had:

- **Multi-step (n=3)** — built into `NStepAccumulator`
- **Twin clipped Q** — SAC's twin-critic is essentially Double-Q
- **PER** — I wrote a SumTree implementation last week
  (priority `p_i = (|δ_i| + ε)^α`, β annealed 0.4 → 1.0)

Adding QR-DQN turns this into a "Mini-Rainbow." Add Noisy Networks and
Dueling and it becomes the real Rainbow. Adding distributional learning on
top turned out to be a smaller delta than I expected.

---

## 2. Two policies, same mean, very different tails

Imagine two models giving the same expected Q-value of `3.2` for a state
and action.

- **Policy A (stable)** over 100 trials: `+3, +3, +4, +3, +3, ...` → mean
  `3.2`, std `0.5`
- **Policy B (one-shot)** over 100 trials: `+10, +10, +10, +10, ..., -26`
  (rare blow-up) → mean `3.2`, std `14`

Vanilla Q-learning **cannot tell them apart**. Both produce `Q = 3.2`.

In finance this is fatal. A strategy that returns 3% steadily for ten years
and then loses -50% once is not the same as one that earns 3% steadily —
even though both have the same mean.

---

## 3. Distributional RL — return as a random variable

The key shift: treat `Q(s, a)` not as a number but as a random variable
`Z(s, a)`.

Standard Bellman:

```
Q(s, a) = E[ R + γ · Q(s', a') ]
```

Distributional Bellman ([Bellemare 2017][c51]):

```
Z(s, a) =D  R + γ · Z(s', A*)
```

The `=D` means "equal in distribution." `Z` is no longer a number; it is a
probability distribution over future returns, and Bellman becomes an
equation over distributions.

### C51 vs QR-DQN — two ways to represent the distribution

**C51** ([Bellemare 2017][c51]):

- Fix a return range `[V_min, V_max]` in advance
- Discretize into 51 atoms
- Learn a softmax probability per atom
- **Problem in finance:** I do not know `V_min / V_max` ahead of time.
  Set them too narrow and outcomes get clipped; too wide and resolution
  collapses.

**QR-DQN** ([Dabney 2018][qrdqn]):

- Fix the *number* of atoms (say `N = 51`)
- But learn the **values** of those atoms from data
- Output shape: `(num_actions, N)` — each cell is "the τ-th quantile of
  this action's return"
- **Why I chose it:** no value-range tuning, smoother training via Huber
  loss, and a clean upgrade path to IQN / FQF.

[c51]: https://arxiv.org/abs/1707.06887
[qrdqn]: https://arxiv.org/abs/1710.10044

---

## 4. The one piece of math worth knowing — Quantile Huber Loss

To learn the τ-th quantile, the loss must be **asymmetric**:

- If `predicted < actual` → penalty `τ · |error|`
- If `predicted > actual` → penalty `(1 - τ) · |error|`

Wrap that in a Huber to handle outliers and you get the **Quantile Huber
Loss**:

```
L_τ(δ) = | τ - 1[δ < 0] | · H_κ(δ)
```

In ten lines of PyTorch:

```python
import torch
import torch.nn.functional as F

def quantile_huber_loss(td_errors, taus, kappa=1.0):
    """
    td_errors: (B, N_target, N_pred) pairwise TD errors
    taus:      (N_pred,)             τ_i = (2i - 1) / (2N) midpoints
    """
    huber = F.smooth_l1_loss(
        td_errors, torch.zeros_like(td_errors),
        reduction='none', beta=kappa,
    )
    asym_weight = torch.abs(
        taus.view(1, 1, -1) - (td_errors.detach() < 0).float()
    )
    return (asym_weight * huber).sum(dim=1).mean(dim=1).mean()
```

Two lines do the work:

- `(td_errors.detach() < 0).float()` — `1` if the error is negative, `0`
  otherwise
- `torch.abs(τ - ...)` — the asymmetric weight; small τ penalizes
  underestimation harder, which is what learns the lower quantiles.

---

## 5. Wiring it into the pair-trading stack

My SAC actor outputs continuous `a ∈ [-1, 1]` that then gets discretized
to `{-1, 0, 1}` for the env. QR-DQN is discrete by design, so it slots in
even more naturally.

```python
class QuantileNet(nn.Module):
    """state -> (num_actions, n_quantiles) Q-distribution."""
    __constants__ = ["n_actions", "n_quantiles"]

    def __init__(self, state_dim, n_actions=3, n_quantiles=51, hidden=256):
        super().__init__()
        self.n_actions = n_actions
        self.n_quantiles = n_quantiles
        self.trunk = nn.Sequential(
            nn.Linear(state_dim, hidden), nn.ReLU(),
            nn.LayerNorm(hidden), nn.Dropout(0.1),
            nn.Linear(hidden, hidden), nn.ReLU(),
            nn.LayerNorm(hidden), nn.Dropout(0.1),
        )
        self.head = nn.Linear(hidden, n_actions * n_quantiles)

    def forward(self, state):
        z = self.trunk(state)
        return self.head(z).view(-1, self.n_actions, self.n_quantiles)
```

The `__constants__` line lets `torch.jit.script` compile this for inference
— a trick I picked up from the SAC actor work, where it gave a measured
×2.13 latency reduction at batch size 1 on CPU.

The Bellman target uses the Double-Q pattern: pick the action with the
**online** network, evaluate it with the **target** network.

```python
with torch.no_grad():
    online_next = agent.q_net(next_states)               # (B, A, N)
    next_a_idx = online_next.mean(dim=-1).argmax(dim=-1) # online picks
    target_next = agent.target_net(next_states)          # (B, A, N)
    z_next = target_next.gather(
        1, next_a_idx[:, None, None].expand(-1, 1, N)
    ).squeeze(1)                                          # (B, N)
    target_z = rewards[:, None] \
             + (1 - dones[:, None]) * (gamma ** n_steps) * z_next
```

---

## 6. CVaR — the one-line payoff

Once QR-DQN is trained, this single function is the entire reason for
doing all of the above:

```python
def cvar(self, state, action_env, alpha=0.05):
    q = self.quantile_dist(state, action_env)        # (51,)
    k = max(1, int(np.ceil(alpha * len(q))))
    return float(np.sort(q)[:k].mean())
```

A unit test verifies the math against a known distribution
`[-10, -5, -2, -1, 0, 1, 2, 3, 4, 5]`:

| Metric | Expected | Got |
|--------|----------|-----|
| Mean | -0.3 | -0.3 ✓ |
| **CVaR₂₀%** | (-10 + -5)/2 = **-7.5** | -7.5 ✓ |
| **CVaR₁₀%** | -10 | -10 ✓ |

This calculation is **impossible with SAC**. SAC only knows the mean; it
has no quantiles to average over.

---

## 7. Three-way benchmark — SAC vs PPO vs QR-DQN

Same 28-dim toy MDP. Same seeds (42, 123, 999). Same 40 episodes. Same
10% eval split. One script:

```text
$ uv run python scripts/bench_rl_algos.py --algos sac,ppo,qrdqn --seeds 42,123,999

──────────────────────────────────────────────────────────────────
  SAC  eval=+0.191 ± 0.004  wall=28.3s
  PPO  eval=+0.214 ± 0.071  wall= 0.9s
QRDQN  eval=+0.146 ± 0.003  wall=46.4s  CVaR₅%=-0.343  CVaR₁₀%=+0.061
──────────────────────────────────────────────────────────────────
```

| Algorithm | Eval reward / step | Wall time | CVaR₅% | CVaR₁₀% |
|-----------|--------------------|-----------|--------|---------|
| SAC | +0.191 ± 0.004 | 28.3s | — | — |
| PPO | +0.214 ± 0.071 | **0.9s** | — | — |
| QR-DQN | +0.146 ± 0.003 | 46.4s | **-0.343** | **+0.061** |

How to read this:

1. **PPO has the highest mean and the fastest wall time.** On-policy
   updates are simple and cheap.
2. **QR-DQN has the lowest mean.** ε-greedy exploration probably needs
   longer schedules on this toy env.
3. **Only QR-DQN has the CVaR columns filled in.** SAC and PPO leave them
   permanently blank — not because of a missing feature, but because their
   loss function never asked them to learn the distribution.
4. **CVaR₅% = -0.343** means the greedy action's worst-5% scenarios
   average a -0.34 loss. The mean reward +0.146 says "this model is
   profitable;" the CVaR says "but its left tail lives in loss territory."

That second sentence is what unlocks risk-aware sizing:

```python
predicted_cvar = qrdqn_agent.cvar(state, action, alpha=0.05)
if predicted_cvar < cvar_target:
    position_size *= max(0, (cvar_target - predicted_cvar) / sigma_cvar)
```

A model that is *aware* the tail is fat will down-size automatically. A
SAC-only system has no choice but to size on the mean, blind to the
distribution shape.

---

## 8. The interview questions this changes

The real value of this work is not the test suite or the benchmark table.
It is that I can now answer three questions I could not answer before:

> **Q1. "Why QR-DQN?"**
> Because SAC learns the expected Q only, so I cannot derive CVaR / VaR /
> distribution variance from it. QR-DQN learns 51 quantiles per action;
> tail-risk metrics drop out in one line, which directly informs position
> sizing and risk-aware exits.

> **Q2. "C51 vs QR-DQN?"**
> C51 needs you to fix the return range up front, which is a non-starter
> in finance where I do not know it. QR-DQN learns the quantile values
> themselves and trains more stably under Huber loss.

> **Q3. "What's the limit of expected-return RL in finance?"**
> Fat tails. Two policies with the same mean can have completely
> different distributions, and every standard hedge-fund risk metric
> (CVaR, VaR, Expected Shortfall) is defined on the distribution, not the
> mean. Expected-Q models can't produce them.

Each answer is grounded in code that exists, a benchmark that ran, and a
math test that passed.

---

## 9. What's next

Working on these in order this week:

1. Wire CVaR-based sizing into the pair-trading backtest path
   (`UnifiedExecutionEngine` entry function) — opt-in, scaffolded
   alongside a statistical baseline signal generator (`rl_stat_only`
   is the default, RL modes are available but not running by default)
2. **IQN** ([Dabney 2018][iqn]) — implicit quantile version of QR-DQN
3. **Deep Hedging** ([Buehler 2019][buehler]) — the option-hedging RL
   classic, applied to pair-trading
4. Follow-up post: **"Building PER from scratch — SumTree to importance
   sampling"**

[iqn]: https://arxiv.org/abs/1806.06923
[buehler]: https://arxiv.org/abs/1802.03042

---

## Code

- `app/trading/rl/agents/qr_dqn.py` — `QRDQNAgent` + `QuantileNet`
- `app/trading/rl/trainers/qr_dqn_trainer.py` — training loop + Huber +
  Double-Q target
- `tests/test_qr_dqn.py` — 10 cases (CVaR math, jit.script
  compatibility, learning signal on toy env)
- `scripts/bench_rl_algos.py` — 3-way benchmark harness

## References

- Bellemare, M. G., Dabney, W., & Munos, R. (2017). *A Distributional
  Perspective on Reinforcement Learning.* ICML 2017.
  [arXiv:1707.06887][c51]
- **Dabney, W., Rowland, M., Bellemare, M. G., & Munos, R. (2018).
  *Distributional Reinforcement Learning with Quantile Regression.*
  AAAI 2018.** [arXiv:1710.10044][qrdqn]
- Dabney, W., Ostrovski, G., Silver, D., & Munos, R. (2018). *Implicit
  Quantile Networks for Distributional RL.* ICML 2018.
  [arXiv:1806.06923][iqn]
- Hessel, M., et al. (2017). *Rainbow: Combining Improvements in Deep
  Reinforcement Learning.* AAAI 2018.
  [arXiv:1710.02298](https://arxiv.org/abs/1710.02298)
- Schaul, T., Quan, J., Antonoglou, I., & Silver, D. (2016). *Prioritized
  Experience Replay.* ICLR 2016.
  [arXiv:1511.05952](https://arxiv.org/abs/1511.05952)
- Haarnoja, T., et al. (2018). *Soft Actor-Critic.* ICML 2018.
  [arXiv:1801.01290][sac]
