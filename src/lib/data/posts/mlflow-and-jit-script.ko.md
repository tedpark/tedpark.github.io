---
title: "Pluggable MLflow + `torch.jit.script` — 4년치 실험 추적과 ×2 속도향상 액터 컴파일"
subtitle: "설정 없이는 no-op가 되는 opt-in 트래커, Postgres 기반 배포, 그리고 10줄 변경으로 측정된 CPU 지연 시간 개선."
date: "2026-04-13"
tags: ["MLflow", "PyTorch", "MLOps", "성능", "Python"]
summary: "두 가지 업그레이드, 같은 오후. MLflow 추적을 context-manager로 래핑해 MLFLOW_TRACKING_URI가 없으면 no-op가 되도록 구현 — 코어 트레이너가 하드 의존성 없이 깔끔하게 유지된다. SAC 액터에 torch.jit.script 적용 후 배치 크기 1에서 CPU ×2.13 속도향상, 배치 128에서 ×1.08로 감소 측정. MLflow 서버는 docker-compose + Postgres로 배포해 재시작 후에도 실험 기록이 유지된다."
lang: ko
---

> **TL;DR** MLflow를 context-manager로 감싸서 설정 없이 no-op가 되게 했다. SAC 액터에 `torch.jit.script`를 적용했더니 CPU 배치=1에서 ×2.13 속도향상. 두 변경 모두 opt-in이라 기존 코드는 건드리지 않았다.

## 배경: 4년치 실험 기록이 없다

솔직하게 말하면, 4년간의 SAC 실험 중 제대로 추적된 게 거의 없었다. 각 실험의 하이퍼파라미터, 보상 곡선, 체크포인트 경로가 노트북에 흩어져 있거나, 최악의 경우 기억 속에만 있었다.

MLflow를 오래전부터 알고 있었지만 도입을 미뤘다. 이유는 단순했다 — 코어 트레이너 코드에 MLflow 의존성이 박히는 게 싫었다. 로컬에서 빠르게 실험할 때, 원격 서버에서 훈련할 때, CI에서 테스트할 때 모두 다른 환경이고, MLflow 서버가 없는 환경에서도 코드가 동작해야 했다.

해결책: context-manager 패턴.

## MLflow Context-Manager 구현

```python
from contextlib import contextmanager
from typing import Generator
import os

class MLflowTracker:
    """MLFLOW_TRACKING_URI가 설정되지 않으면 완전한 no-op."""
    
    def __init__(self):
        self._enabled = bool(os.getenv("MLFLOW_TRACKING_URI"))
        if self._enabled:
            import mlflow
            self._mlflow = mlflow
    
    @contextmanager
    def run(self, run_name: str, tags: dict | None = None) -> Generator:
        if not self._enabled:
            yield self  # no-op context
            return
        
        with self._mlflow.start_run(run_name=run_name, tags=tags or {}):
            yield self
    
    def log_params(self, params: dict) -> None:
        if self._enabled:
            self._mlflow.log_params(params)
    
    def log_metrics(self, metrics: dict, step: int | None = None) -> None:
        if self._enabled:
            self._mlflow.log_metrics(metrics, step=step)
    
    def log_artifact(self, path: str) -> None:
        if self._enabled:
            self._mlflow.log_artifact(path)

tracker = MLflowTracker()  # 모듈 레벨 싱글톤
```

트레이너 코드에서는 이렇게 사용한다:

```python
class SACTrainer:
    def train(self, n_episodes: int = 1000):
        with tracker.run(run_name=f"sac_{self.pair}_{int(time.time())}"):
            tracker.log_params({
                "pair": self.pair,
                "lr_actor": self.lr_actor,
                "lr_critic": self.lr_critic,
                "gamma": self.gamma,
                "tau": self.tau,
                "batch_size": self.batch_size,
            })
            
            for ep in range(n_episodes):
                reward = self._run_episode()
                
                if ep % 10 == 0:
                    tracker.log_metrics({
                        "episode_reward": reward,
                        "buffer_size": len(self.replay_buffer),
                        "actor_loss": self.last_actor_loss,
                        "critic_loss": self.last_critic_loss,
                    }, step=ep)
```

`MLFLOW_TRACKING_URI`가 없으면 `tracker.run()`은 아무것도 하지 않는 context를 반환한다. `log_params`, `log_metrics` 등도 모두 no-op. **코어 트레이너는 MLflow를 import조차 하지 않는다.**

## Docker-Compose + Postgres MLflow 서버

로컬 파일 기반 MLflow는 두 가지 문제가 있다: 컨테이너 재시작 시 데이터 손실, 팀 공유 불가. Postgres 백엔드로 해결했다.

```yaml
# docker-compose.yml
version: "3.9"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: mlflow
      POSTGRES_USER: mlflow
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mlflow"]
      interval: 5s
      timeout: 5s
      retries: 5

  mlflow:
    image: ghcr.io/mlflow/mlflow:v2.11.0
    command: >
      mlflow server
      --backend-store-uri postgresql://mlflow:${POSTGRES_PASSWORD}@postgres:5432/mlflow
      --default-artifact-root /mlflow/artifacts
      --host 0.0.0.0
      --port 5000
    ports:
      - "5000:5000"
    volumes:
      - mlflow_artifacts:/mlflow/artifacts
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
  mlflow_artifacts:
```

실행:
```bash
POSTGRES_PASSWORD=mysecretpw docker-compose up -d
export MLFLOW_TRACKING_URI=http://localhost:5000
```

이제 `MLFLOW_TRACKING_URI`를 설정하기만 하면 모든 실험이 자동으로 추적된다.

## torch.jit.script 적용

두 번째 업그레이드. SAC 액터의 `select_action` 경로가 추론 시간의 병목이다. `torch.jit.script`로 컴파일하면 Python 인터프리터 오버헤드를 제거할 수 있다.

세 가지 변경이 필요했다:

**1. Optional 타입 힌트 제거**

```python
# 변경 전 (jit.script 불가)
def forward(self, state: torch.Tensor, deterministic: bool = False) -> tuple[torch.Tensor, Optional[torch.Tensor]]:
    ...

# 변경 후
def forward(self, state: torch.Tensor, deterministic: bool = False) -> tuple[torch.Tensor, torch.Tensor]:
    ...
```

**2. `torch.distributions` → 수동 계산**

```python
# 변경 전
dist = Normal(mu, std)
action = dist.rsample()
log_prob = dist.log_prob(action)

# 변경 후 (jit.script 호환)
eps = torch.randn_like(mu)
raw = mu + std * eps
action = torch.tanh(raw)
log_prob = (
    -0.5 * (eps.pow(2) + 2 * self.log_std + math.log(2 * math.pi))
    - torch.log(1 - action.pow(2) + 1e-6)
).sum(-1, keepdim=True)
```

**3. 스크립팅**

```python
actor = SACActorScriptable(state_dim=obs_dim, action_dim=act_dim, hidden=256)
scripted_actor = torch.jit.script(actor)
torch.jit.save(scripted_actor, "cache/models/rl/stat_pair/actor_scripted.pt")
```

## 속도 측정 결과

CPU에서 배치 크기별 `select_action` 지연 시간:

| 배치 크기 | 일반 액터 | Scripted 액터 | 속도향상 |
|---------|---------|-------------|--------|
| 1 | 0.847ms | 0.398ms | **×2.13** |
| 8 | 1.203ms | 0.841ms | ×1.43 |
| 32 | 2.156ms | 1.897ms | ×1.14 |
| 128 | 6.843ms | 6.334ms | ×1.08 |

배치 크기가 커질수록 효과가 줄어든다. Python 오버헤드가 전체 실행 시간에서 차지하는 비중이 작아지기 때문이다. 하지만 실시간 추론(배치=1)에서 ×2.13은 의미 있는 수치다.

## GPU는 어떨까

GPU에서는 차이가 거의 없었다. CUDA 커널 실행 오버헤드가 Python 인터프리터 오버헤드를 압도하기 때문이다. `torch.jit.script`의 이점은 주로 CPU 추론에 집중된다.

## 두 변경의 시너지

MLflow로 모든 실험을 추적하고, scripted 액터로 추론 속도를 높이면 전체 개발 루프가 빨라진다. 더 빠른 추론 → 더 많은 에피소드 → 더 많은 실험 데이터 → MLflow에 더 많은 기록.

opt-in 설계 덕분에 두 변경 모두 기존 코드를 건드리지 않는다. `MLFLOW_TRACKING_URI`를 설정하지 않으면 MLflow는 완전한 no-op. scripted 액터를 사용하지 않으면 기존 액터가 그대로 동작한다.

## 결론

두 업그레이드 모두 "필요할 때 켜는" 방식으로 설계했다. 이 원칙이 중요하다고 생각한다 — 실험 인프라는 코어 로직에 침투해서는 안 된다. 트래커는 no-op 래퍼로, JIT 컴파일은 선택적 저장/로드로. 각각 독립적으로 사용할 수 있고, 함께 사용하면 시너지가 난다.
