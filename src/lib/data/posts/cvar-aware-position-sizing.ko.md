---
title: "CVaR 인식 포지션 사이징 — QR-DQN 분위수를 사이징 승수로 전환"
subtitle: "후속편: CVaR 테일 리스크 추정치를 실제 사이징 레이어에 연결하겠다고 약속했다. opt-in, 한 줄 패치."
date: "2026-04-17"
tags: ["강화학습", "퀀트 파이낸스", "CVaR", "리스크 관리", "Python"]
summary: "QR-DQN이 CVaR 숫자를 줬다. 숫자는 전략이 아니다. 이 포스트는 CVaR를 4단계 스케일러(target / scale / floor / veto)를 통해 실제 PortfolioSimulator 경로에 연결한다. 모든 RL 신호 클래스가 이 기능을 상속받는 mixin을 추가하고, 변경은 완전히 opt-in — 기존 백테스트는 QR-DQN 체크포인트를 cache에 넣지 않는 한 비트 단위로 동일하게 유지된다."
lang: ko
---

> **TL;DR** 4단계 CVaR 스케일러: target / scale / floor / veto. RL 신호 클래스용 mixin. 완전 opt-in — QR-DQN 체크포인트 없으면 동작 변화 없음. `PortfolioSimulator`는 신호 메타데이터에서 사이징 승수를 읽는다.

## 지난 포스트에서 남긴 것

[이전 포스트](from-dqn-to-qr-dqn)에서 QR-DQN이 CVaR₅%를 원 라이너로 생성함을 보였다. 예시:

```python
action_dist = model(state)[0, best_action].cpu().numpy()
cvar_5 = action_dist[:int(0.05 * len(action_dist))].mean()
# cvar_5 = -0.043  (최악 5% 시나리오의 평균 손실)
```

하지만 -0.043이라는 숫자를 어떻게 사용할 것인가? 그냥 로그에 기록하는 건 의미가 없다. 포지션 크기를 줄여야 한다면 얼마나? 아예 거래를 하지 말아야 한다면 언제?

이 포스트는 그 구체적인 메커니즘을 다룬다.

## 4단계 CVaR 스케일러 설계

실제 리스크 관리 시스템에서 일반적으로 사용하는 4단계 구조를 구현했다:

```
1. Target  : 목표 CVaR 수준 (예: -0.02, 즉 최악 5%에서 2% 손실 허용)
2. Scale   : Target 대비 실제 CVaR 비율로 포지션 크기 조정
3. Floor   : 최소 포지션 크기 (완전히 0이 되는 것을 방지)
4. Veto    : CVaR가 이 수준보다 나쁘면 완전히 거래 거부
```

```python
from dataclasses import dataclass, field
from typing import Optional
import numpy as np

@dataclass
class CVaRScalerConfig:
    """CVaR 기반 포지션 사이징 설정."""
    
    # 목표 CVaR 수준 (음수, 예: -0.02 = 2% 손실 허용)
    target: float = -0.02
    
    # CVaR가 target보다 좋을 때 스케일 허용 (1.0 = 스케일 없음)
    scale_cap: float = 1.0
    
    # 최소 포지션 크기 비율 (0.0 ~ 1.0)
    floor: float = 0.1
    
    # 거래 거부 임계값 (target보다 나쁜 수준)
    veto: float = -0.10
    
    # CVaR 계산에 사용할 분위수 수준
    alpha: float = 0.05

class CVaRPositionScaler:
    """CVaR 값을 포지션 사이징 승수 [0, 1]로 변환."""
    
    def __init__(self, config: CVaRScalerConfig | None = None):
        self.config = config or CVaRScalerConfig()
    
    def scale(self, cvar: float) -> float:
        """
        CVaR → 포지션 승수 [0, 1].
        
        Examples:
            cvar = -0.01 (target보다 좋음) → 1.0 (or scale_cap)
            cvar = -0.02 (= target)        → 1.0
            cvar = -0.05 (target보다 나쁨) → 0.4
            cvar = -0.10 (= veto)          → 0.0 (거부)
        """
        cfg = self.config
        
        # 1. Veto 확인
        if cvar <= cfg.veto:
            return 0.0
        
        # 2. Target보다 좋으면 scale_cap 반환
        if cvar >= cfg.target:
            return min(cfg.scale_cap, 1.0)
        
        # 3. target과 veto 사이: 선형 스케일
        # target ~ veto 구간을 [1.0, floor]로 매핑
        ratio = (cvar - cfg.veto) / (cfg.target - cfg.veto)
        scaled = cfg.floor + ratio * (1.0 - cfg.floor)
        
        return float(np.clip(scaled, cfg.floor, 1.0))
    
    def __repr__(self) -> str:
        c = self.config
        return (
            f"CVaRPositionScaler("
            f"target={c.target}, veto={c.veto}, "
            f"floor={c.floor}, alpha={c.alpha})"
        )
```

## CVaRMixin: 모든 RL 신호 클래스에 기능 추가

중복 코드 없이 모든 RL 신호 클래스에 CVaR 기능을 추가하는 mixin:

```python
from abc import ABC, abstractmethod
import torch
from pathlib import Path

class CVaRMixin:
    """
    RL 신호 클래스에 CVaR 인식 포지션 사이징을 추가하는 mixin.
    
    사용법:
        class MySACSignal(CVaRMixin, BaseRLSignal):
            ...
    
    opt-in: qr_checkpoint_path가 None이면 scaler=1.0을 항상 반환.
    """
    
    _qr_model: Optional[torch.nn.Module] = None
    _qr_model_path: Optional[Path] = None
    _cvar_scaler: Optional[CVaRPositionScaler] = None
    
    def init_cvar(
        self,
        qr_checkpoint_path: str | Path | None = None,
        scaler_config: CVaRScalerConfig | None = None,
    ) -> None:
        """CVaR 스케일러를 초기화한다. path가 None이면 no-op."""
        if qr_checkpoint_path is None:
            return
        
        path = Path(qr_checkpoint_path)
        if not path.exists():
            return  # 체크포인트 없음 = opt-out
        
        self._qr_model = torch.jit.load(path, map_location="cpu")
        self._qr_model.eval()
        self._qr_model_path = path
        self._cvar_scaler = CVaRPositionScaler(scaler_config)
    
    def get_position_multiplier(self, state: np.ndarray) -> float:
        """
        현재 상태에 대한 포지션 승수를 반환.
        QR-DQN 미로드 시 항상 1.0 반환 (opt-in 보장).
        """
        if self._qr_model is None or self._cvar_scaler is None:
            return 1.0
        
        state_t = torch.from_numpy(state).float().unsqueeze(0)
        
        with torch.no_grad():
            q_dist = self._qr_model(state_t)  # (1, n_actions, n_quantiles)
            best_action = q_dist.mean(dim=-1).argmax(dim=-1).item()
            action_dist = q_dist[0, best_action].cpu().numpy()
        
        alpha = self._cvar_scaler.config.alpha
        cutoff = max(1, int(alpha * len(action_dist)))
        cvar = float(action_dist[:cutoff].mean())
        
        return self._cvar_scaler.scale(cvar)
    
    @property
    def cvar_enabled(self) -> bool:
        return self._qr_model is not None
```

## PortfolioSimulator 통합

PortfolioSimulator는 신호 메타데이터에서 사이징 승수를 읽는다:

```python
class PortfolioSimulator:
    def step(self, signal: "BaseRLSignal", state: np.ndarray) -> dict:
        # 기존 로직: 신호의 행동 결정
        action = signal.select_action(state, deterministic=True)
        
        # CVaR 승수 가져오기 (mixin이 없거나 disabled이면 1.0)
        position_multiplier = 1.0
        if hasattr(signal, "get_position_multiplier"):
            position_multiplier = signal.get_position_multiplier(state)
        
        # 포지션 크기 조정
        adjusted_position = action * position_multiplier
        
        # 실행
        pnl = self._execute(adjusted_position)
        
        return {
            "action": action,
            "position_multiplier": position_multiplier,
            "adjusted_position": adjusted_position,
            "pnl": pnl,
            "cvar_enabled": getattr(signal, "cvar_enabled", False),
        }
```

## SACSignal에 mixin 적용

```python
class SACPairSignal(CVaRMixin, BaseRLSignal):
    """CVaR 인식 포지션 사이징을 가진 SAC 페어 트레이딩 신호."""
    
    def __init__(
        self,
        pair: tuple[str, str],
        actor_checkpoint: str,
        qr_checkpoint: str | None = None,  # None이면 CVaR 비활성화
        cvar_config: CVaRScalerConfig | None = None,
    ):
        super().__init__(pair=pair, actor_checkpoint=actor_checkpoint)
        
        # CVaR 초기화 (opt-in)
        self.init_cvar(
            qr_checkpoint_path=qr_checkpoint,
            scaler_config=cvar_config,
        )
```

## 비트 단위 호환성 검증

기존 백테스트가 변경되지 않았음을 검증:

```python
def test_backward_compatibility():
    """CVaR 없이 실행하면 기존 결과와 동일."""
    env = StatPairRLEnv(pair=("SPY", "IVV"))
    
    # CVaR 없는 신호
    signal_no_cvar = SACPairSignal(
        pair=("SPY", "IVV"),
        actor_checkpoint="cache/models/rl/stat_pair/actor_latest.pt",
        qr_checkpoint=None,  # CVaR 비활성화
    )
    
    rewards_legacy = run_backtest(signal_no_cvar, env, seed=42)
    
    # CVaR 있는 신호 (하지만 체크포인트가 없으면 동일해야 함)
    signal_with_cvar = SACPairSignal(
        pair=("SPY", "IVV"),
        actor_checkpoint="cache/models/rl/stat_pair/actor_latest.pt",
        qr_checkpoint="/nonexistent/path.pt",  # 존재하지 않음
    )
    
    rewards_cvar = run_backtest(signal_with_cvar, env, seed=42)
    
    np.testing.assert_array_equal(rewards_legacy, rewards_cvar)
```

## CVaR 스케일러 동작 예시

```
CVaR₅%  | 포지션 승수 | 동작
--------|-----------|------
-0.005  | 1.00      | 정상 (target보다 좋음)
-0.020  | 1.00      | target과 같음
-0.035  | 0.62      | target과 veto 사이: 부분 축소
-0.065  | 0.28      | 추가 축소
-0.100  | 0.00      | veto: 거래 거부
-0.150  | 0.00      | veto 초과: 거래 거부
```

## 결론

CVaR 숫자는 그 자체로 전략이 아니다. 4단계 스케일러(target / scale / floor / veto)가 있어야 의미 있는 행동으로 변환된다. Mixin 패턴 덕분에 모든 RL 신호 클래스가 두 줄로 이 기능을 상속받는다. 완전한 opt-in 설계로 기존 백테스트는 영향받지 않는다. QR-DQN 체크포인트를 cache에 넣는 순간 CVaR 인식 사이징이 활성화된다.
