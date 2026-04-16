---
title: "CVaR-Aware Position Sizing — Turning QR-DQN Quantiles into a Sizing Multiplier"
subtitle: "The follow-up: I promised to wire the tail-risk estimate into the sizing layer. Here's the opt-in, one-line patch that does it."
date: "2026-04-17"
tags: ["Reinforcement Learning", "Quantitative Finance", "CVaR", "Risk Management", "Python"]
summary: "QR-DQN gave me a CVaR number. A number is not a strategy. This post wires that CVaR into the actual PortfolioSimulator path via a four-tier scaler (target / scale / floor / veto), adds a mixin so every RL signal class inherits the capability, and keeps the change fully opt-in — existing backtests stay bit-for-bit identical unless you drop a QR-DQN checkpoint into the cache."
---

> **TL;DR.** Previous post turned QR-DQN's 51-quantile output into a
> `CVaR₅%` number. This post turns that number into an actual sizing decision
> inside the backtested pair-trading system. Four tiers — **target / scale /
> floor / veto** — map a CVaR estimate to a multiplier in `[0, 1]` that the
> `PortfolioSimulator` reads from signal metadata. One line in
> `portfolio.py` changes; everything else stays the same. Opt-in: no
> QR-DQN checkpoint, no behaviour change.

---

## 0. Recap and what I promised

The [previous post][post1] ended with this pseudo-code:

```python
predicted_cvar = qrdqn_agent.cvar(state, action, alpha=0.05)
if predicted_cvar < cvar_target:
    position_size *= max(0, (cvar_target - predicted_cvar) / sigma_cvar)
```

That's a nice slide. It is not a system. To put it into the signal-to-sizing path I had
to answer four questions:

1. **Where** do I hook? The signal generator? The portfolio simulator?
2. **When** do I load the QR-DQN model? Up front? Lazily?
3. **How** do I keep existing SAC backtests reproducible when the new
   sizing is optional?
4. **What happens** when the CVaR estimate is garbage (NaN, model
   missing, dim mismatch)?

This post walks through each of those.

[post1]: /blog/from-dqn-to-qr-dqn

---

## 1. The shape of the scaler

I want a function `cvar → multiplier ∈ [0, 1]` with these properties:

- **No penalty when CVaR is benign** (≥ target) → multiplier `1.0`
- **Linear shrink** as CVaR worsens, not a cliff
- **Size floor** so even a very bearish model can't zero the book on
  spurious tails
- **Hard veto** at an extreme threshold (skip the trade entirely)
- **NaN / Inf safe** — bad inputs fall back to the floor, not to `1.0`

### The math (10 lines)

```
excess  = max(0, cvar_target - predicted_cvar)
penalty = excess / cvar_scale
scale   = clip(1 - penalty, size_floor, 1.0)
```

Three knobs:

- `cvar_target` — the "OK" threshold. CVaR ≥ target → `1.0`.
- `cvar_scale` — penalty bandwidth. Smaller = steeper shrink.
- `size_floor` — hard minimum multiplier.

Plus one boolean:

- `veto_threshold` — if `predicted_cvar < veto_threshold`, return `0`.

### Defaults I settled on

```python
CVaRSizingConfig(
    alpha=0.05,
    cvar_target=-0.05,    # tolerate up to -5% in the worst 5% of cases
    cvar_scale=0.10,      # each extra -10% of CVaR = full shrink
    size_floor=0.20,      # never below 20% of base
    veto_threshold=-0.30, # CVaR < -30% → skip the trade
)
```

These are the numbers that survived a week of experimenting. The floor
matters more than I expected — without it, a freshly-trained model's
over-confident early predictions can wipe out most positions.

---

## 2. The scaler in action — ten data points

Here's the full curve for a `$10,000` base notional:

```
─────────────────────────────────────────────────────────
    predicted CVaR     scale     allocated $    note
─────────────────────────────────────────────────────────
            +0.050     1.000  $      10,000    ✅ no penalty
             0.000     1.000  $      10,000    ✅ no penalty
            -0.050     1.000  $      10,000    ✅ no penalty
            -0.070     0.800  $       8,000    ↘ shrinking
            -0.100     0.500  $       5,000    ↘ shrinking
            -0.130     0.200  $       2,000    ⚠️ hit floor
            -0.200     0.200  $       2,000    ⚠️ hit floor
            -0.300     0.200  $       2,000    ⚠️ hit floor
            -0.500     0.000  $           0    ✋ vetoed
─────────────────────────────────────────────────────────
```

Even a $10K position that the mean would happily take gets down-sized to
$2K when the worst-5% scenarios say we lose 13% — and killed entirely
when the worst case says -50%. SAC cannot produce any of the columns to
the left of `scale`; this table is the entire reason QR-DQN exists in my
stack.

---

## 3. The pure function (no dependencies)

```python
# app/trading/risk/cvar_sizing.py
import numpy as np
from dataclasses import dataclass
from typing import Optional

@dataclass
class CVaRSizingConfig:
    alpha: float = 0.05
    cvar_target: float = -0.05
    cvar_scale: float = 0.10
    size_floor: float = 0.20
    veto_threshold: Optional[float] = None


def cvar_position_scaler(
    predicted_cvar: float,
    cfg: Optional[CVaRSizingConfig] = None,
) -> float:
    cfg = cfg or CVaRSizingConfig()

    if not np.isfinite(predicted_cvar):
        return float(cfg.size_floor)     # garbage input → conservative floor

    if cfg.veto_threshold is not None and predicted_cvar < cfg.veto_threshold:
        return 0.0

    if predicted_cvar >= cfg.cvar_target:
        return 1.0

    excess = cfg.cvar_target - predicted_cvar
    penalty = excess / max(cfg.cvar_scale, 1e-9)
    return float(np.clip(1.0 - penalty, cfg.size_floor, 1.0))
```

Dependencies: **numpy only**. No torch, no pydantic, no network. That
matters because this function runs *inside every signal generation*; I
want the blast radius of a bug to be zero.

---

## 4. Wrapping it up with the model — `CVaRSizer`

The model-dependent part goes in a small class:

```python
from typing import Protocol

class CVaRSource(Protocol):
    """Anything with a cvar(state, action_env, alpha) method is fine.
    This is duck-typed — QR-DQN today, IQN tomorrow, something else later.
    """
    def cvar(self, state: np.ndarray, action_env: int, alpha: float) -> float: ...


class CVaRSizer:
    def __init__(self, source: CVaRSource, cfg: Optional[CVaRSizingConfig] = None):
        self.source = source
        self.cfg = cfg or CVaRSizingConfig()

    def scale_for(self, state: np.ndarray, action_env: int) -> tuple[float, float]:
        cvar = float(self.source.cvar(state, action_env, alpha=self.cfg.alpha))
        return cvar_position_scaler(cvar, self.cfg), cvar
```

The `Protocol` is the key design choice. Any future distributional agent
(IQN, FQF, some fine-tuned variant) that exposes `.cvar()` slots in
without changing this module.

---

## 5. The integration — one line in `PortfolioSimulator`

The existing sizing code:

```python
# app/trading/backtest/portfolio.py:184 (before)
alloc = capital * per_trade_alloc
```

Becomes:

```python
# after — one line change
cvar_scale = float(sig.metadata.get("cvar_scale", 1.0)) if sig.metadata else 1.0
alloc = capital * per_trade_alloc * cvar_scale
```

When the signal metadata doesn't include `cvar_scale`, the multiplier is
`1.0` and the backtest is bit-for-bit identical to the pre-CVaR
behaviour. I cannot emphasise enough how important this "no change unless
opt-in" property is — it means adding CVaR sizing cannot regress any
previous result.

---

## 6. The stamp — how `cvar_scale` lands in the metadata

Inside the signal generator, right before emitting a `TradingSignal`:

```python
def _stamp_cvar_metadata(self, meta, pair_id, bar_idx, pp):
    """Mutate meta to include cvar_scale / cvar_loss when sizer is loaded.
    Silent no-op when absent — preserves default sizing behaviour.
    """
    if not self._cvar_sizer_attempted:
        try:
            self._cvar_sizer = self._load_cvar_sizer()
        except Exception as exc:
            logger.warning("CVaR sizer init failed: %s", exc)
            self._cvar_sizer = None
        self._cvar_sizer_attempted = True

    if self._cvar_sizer is None:
        return

    rl_state = self._build_rl_state(pair_id, bar_idx, pp)
    if rl_state is None:
        return

    try:
        scale, cvar = self._cvar_sizer.scale_for(rl_state, action_env=+1)
        meta["cvar_scale"] = float(scale)
        meta["cvar_loss"] = float(cvar)
    except Exception as exc:
        logger.debug("CVaR scale_for failed for pair %s: %s", pair_id, exc)
```

Four things worth pointing out:

1. **Lazy load**: the QR-DQN agent comes off disk on first call, not at
   signal-class construction. Saves memory and start-up latency when no
   checkpoint exists.
2. **Cached attempt**: `_cvar_sizer_attempted` flag avoids re-trying the
   disk scan on every bar.
3. **Silent failure**: if anything goes wrong — state build fails, model
   missing, dim mismatch — we drop the stamp and leave the signal as-is.
   Catching in the signal generator is *wrong* in general, but here
   "no CVaR sizing for this bar" is a graceful degradation.
4. **Reused state builder**: `_build_rl_state` already exists for SAC
   exit checks; we call the same function. No duplicate state logic.

---

## 7. The mixin — every RL signal inherits for free

Putting the loader in a base class means every signal strategy (pair,
breakout, future ones) gets CVaR sizing automatically as soon as a
checkpoint exists:

```python
# app/trading/rl/signal_base.py
class RLSignalBase:
    _rl_strategy:   str = ""
    _rl_model_type: str = "rl"
    _rl_env_var:    str = ""
    _cvar_env_var:  str = ""  # new

    def _load_cvar_sizer(self, alpha=0.05, cvar_target=-0.05,
                         cvar_scale=0.10, size_floor=0.20,
                         veto_threshold=None):
        from app.trading.risk.cvar_sizing import CVaRSizer, CVaRSizingConfig
        from app.trading.rl.agents.qr_dqn import QRDQNAgent
        from app.trading.rl.model_store import ModelStore

        # 1. Explicit env var override
        env_path = os.environ.get(self._cvar_env_var, "") if self._cvar_env_var else ""
        path = env_path if env_path and os.path.isfile(env_path) else None

        # 2. ModelStore lookup under <strategy>_qrdqn
        if path is None:
            qrdqn_strategy = f"{self._rl_strategy}_qrdqn" if self._rl_strategy else ""
            try:
                store_path = ModelStore.best_path(qrdqn_strategy, self._rl_model_type)
                path = str(store_path) if store_path else None
            except Exception:
                path = None

        if path is None:
            return None

        agent = QRDQNAgent.load(path)
            agent.eval_mode()
            cfg = CVaRSizingConfig(alpha=alpha, cvar_target=cvar_target,
                                   cvar_scale=cvar_scale, size_floor=size_floor,
                                   veto_threshold=veto_threshold)
            return CVaRSizer(agent, cfg)
```

The pair-trading signal only needs:

```python
class StatPairRLSignal(RLSignalBase, ...):
    _rl_strategy  = "stat_pair"
    _rl_env_var   = "STAT_PAIR_RL_MODEL"
    _cvar_env_var = "STAT_PAIR_QRDQN_MODEL"   # opt-in
```

---

## 8. Testing the scaler — 10 cases

Pure math → pure tests. No model needed:

```python
# tests/test_cvar_sizing.py — selected highlights

def test_linear_penalty_band():
    cfg = CVaRSizingConfig(cvar_target=-0.05, cvar_scale=0.10, size_floor=0.0)
    assert cvar_position_scaler(-0.05, cfg) == pytest.approx(1.0)   # at target
    assert cvar_position_scaler(-0.10, cfg) == pytest.approx(0.5)   # halfway
    assert cvar_position_scaler(-0.15, cfg) == pytest.approx(0.0)   # end of band

def test_nan_and_inf_return_floor():
    cfg = CVaRSizingConfig(size_floor=0.25)
    assert cvar_position_scaler(float("nan"), cfg) == pytest.approx(0.25)
    assert cvar_position_scaler(float("inf"), cfg) == pytest.approx(0.25)

def test_sizer_uses_alpha_from_config():
    captured = {}
    class _Spy:
        def cvar(self, state, action_env, alpha):
            captured["alpha"] = alpha
            return -0.07
    sizer = CVaRSizer(_Spy(), CVaRSizingConfig(alpha=0.123))
    sizer.scale_for(np.zeros(4), action_env=1)
    assert captured["alpha"] == pytest.approx(0.123)
```

Full suite passes in **1.34 s** (10 cases). Plus four more cases on the
mixin (`test_signal_base_cvar.py`) that exercise the full load path with
a real QR-DQN checkpoint.

---

## 9. The `/cvar/*` serving endpoints

Having CVaR computation in memory is one thing. Exposing it over HTTP so
the dashboard / TUI / other services can query it is another. I mirrored
the `/sac/*` pattern:

```
GET   /cvar/health              — model loaded?
GET   /cvar/model/info          — current checkpoint metadata
POST  /cvar/model/reload        — force hot-reload
POST  /cvar/predict             — state → greedy action (int in {-1, 0, 1})
POST  /cvar/predict/batch       — batched version
POST  /cvar/cvar                — state + action → CVaR + mean + uncertainty
POST  /cvar/distribution        — state + action → all 51 quantiles
```

The last two are the interesting ones. Example:

```bash
$ curl -s http://localhost:8765/cvar/cvar \
      -d '{"state": [0.0, ...28 values...], "action_env": 1, "alpha": 0.05}' \
      -H 'content-type: application/json' | jq
{
  "cvar": -0.341,
  "mean": +0.152,
  "uncertainty": 0.283,
  "action_env": 1,
  "alpha": 0.05,
  "model_path": "cache/models/rl/stat_pair_qrdqn/model_2026-04-16.pt"
}
```

SAC's `/sac/predict` can never produce that response body — it doesn't
have the distribution internally. The 7 e2e tests on this router cover
cold start, hot reload, forced reload, shape validation, and Pydantic
validation of `alpha ∈ (0, 1)` and `action_env ∈ {-1, 0, 1}`.

---

## 10. What this costs (almost nothing)

Lines changed in existing files:

- `portfolio.py`: **1 line** (the `* cvar_scale` multiplier)
- `signal_base.py`: **+60 lines** (a new method; no change to existing
  methods)
- `stat_pair_rl.py`: **+20 lines** (lazy load + stamp helper)

New files (all orthogonal to existing code):

- `app/trading/risk/cvar_sizing.py` — 170 lines
- `stocktradingai/server/cvar_serving.py` — 310 lines
- Three test files — 280 lines total

Total test count across the stack: **59 passing** (Steps 1–7), 1m 14s
wall time. No regressions.

---

## 11. Interview answers this enables

The real ROI is in the three questions I can now answer concretely,
building on the ones from the [previous post][post1]:

> **Q. "How do you translate a risk metric into an actual sizing decision?"**
> Four tiers. Target (no penalty), scale (linear shrink bandwidth), floor
> (hard minimum), veto (hard skip). All live in a 170-line module with
> 10 unit tests; the integration is a one-line change in
> `PortfolioSimulator` that reads from signal metadata. Opt-in — no
> checkpoint, no behaviour change.

> **Q. "What's your fallback when the risk model is unavailable?"**
> `sig.metadata.get('cvar_scale', 1.0)` — the missing key is the fallback.
> A crashed or missing QR-DQN agent produces zero metadata, the
> simulator uses `1.0`, and the backtest is identical to pre-CVaR.

> **Q. "How do you handle NaN / Inf model outputs?"**
> Fall back to `size_floor`, not to `1.0`. Be conservative when uncertain
> — the cost of missing a trade is small; the cost of sizing on a garbage
> output is large.

---

## 12. What's next

1. **Live CVaR data in the Tauri dashboard** — the `/cvar/distribution`
   endpoint already returns the 51 quantiles; a small chart would show
   the policy's confidence region in real time.
2. **IQN (Dabney 2018)** — variable quantile count; QR-DQN is the fixed
   case.
3. **Rolling CVaR drift detection** — when predicted CVaR shifts
   systematically across days, that's a regime-change signal
   independent of the HMM layer.
4. The next post in this series will be on **[Prioritized Experience
   Replay][post5]** — implementing SumTree from scratch and wiring it
   into SAC's update step.

---

## Code

- `app/trading/risk/cvar_sizing.py` — core sizer
- `app/trading/rl/signal_base.py` — `_load_cvar_sizer` mixin
- `app/trading/backtest/signals/stat_pair_rl.py` — signal stamping
- `app/trading/backtest/portfolio.py:189` — one-line patch
- `stocktradingai/server/cvar_serving.py` — FastAPI endpoints
- `tests/test_cvar_sizing.py`, `test_signal_base_cvar.py`,
  `test_cvar_serving.py` — 21 cases total
- `scripts/demo_cvar_sizing.py` — the table from §2 above

## References

- Rockafellar, R. T., & Uryasev, S. (2000). *Optimization of Conditional
  Value-at-Risk.* Journal of Risk 2(3), 21–41.
- Dabney, W., Rowland, M., Bellemare, M. G., & Munos, R. (2018).
  *Distributional Reinforcement Learning with Quantile Regression.*
  AAAI 2018. [arXiv:1710.10044](https://arxiv.org/abs/1710.10044)

[post5]: /blog/per-from-scratch
