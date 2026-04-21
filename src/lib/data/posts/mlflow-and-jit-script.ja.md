---
title: "Pluggable MLflow + `torch.jit.script` — 4 年分の実験追跡と ×2 速度向上アクターのコンパイル"
subtitle: "設定なしで no-op になる opt-in トラッカー、Postgres バックエンドのデプロイ、10 行のアクター変更で測定された CPU レイテンシ改善。"
date: "2026-04-13"
tags: ["MLflow", "PyTorch", "MLOps", "パフォーマンス", "Python"]
summary: "2 つのアップグレード、同じ午後。MLflow 追跡を context-manager でラップし、MLFLOW_TRACKING_URI 未設定時は graceful な no-op に — コアトレーナーをハード依存性から解放。SAC アクターに torch.jit.script を適用し、バッチサイズ 1 の CPU で ×2.13 速度向上、バッチ 128 では ×1.08 に低下することを測定。MLflow サーバーは docker-compose + Postgres で動作させ、デプロイをまたいで実行記録が永続する。"
lang: ja
---

> **TL;DR** MLflow を context-manager でラップして、設定なしで no-op にした。SAC アクターに `torch.jit.script` を適用したら CPU バッチ=1 で ×2.13 速度向上。両変更とも opt-in で既存コードには触れていない。

## 背景: 4 年分の実験記録がない

正直に言えば、4 年間の SAC 実験の大半はきちんと追跡されていなかった。各実験のハイパーパラメータ、報酬曲線、チェックポイントのパスがノートブックに散らばっているか、最悪の場合は記憶の中にしかなかった。

MLflow は以前から知っていたが導入を先送りにしていた。理由は単純だった — コアトレーナーのコードに MLflow の依存性を埋め込みたくなかった。ローカルで素早く実験するとき、リモートサーバーで訓練するとき、CI でテストするとき、それぞれ異なる環境であり、MLflow サーバーがない環境でもコードが動作する必要があった。

解決策: context-manager パターン。

## MLflow Context-Manager の実装

```python
from contextlib import contextmanager
from typing import Generator
import os

class MLflowTracker:
    """MLFLOW_TRACKING_URI が設定されていなければ完全な no-op。"""
    
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

tracker = MLflowTracker()  # モジュールレベルのシングルトン
```

トレーナーのコードではこのように使う:

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

`MLFLOW_TRACKING_URI` がなければ `tracker.run()` は何もしない context を返す。`log_params`、`log_metrics` なども全て no-op。**コアトレーナーは MLflow を import すらしない。**

## Docker-Compose + Postgres MLflow サーバー

ローカルファイルベースの MLflow には 2 つの問題がある: コンテナ再起動時のデータ消失、チーム共有不可。Postgres バックエンドで解決した。

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

起動:
```bash
POSTGRES_PASSWORD=mysecretpw docker-compose up -d
export MLFLOW_TRACKING_URI=http://localhost:5000
```

あとは `MLFLOW_TRACKING_URI` を設定するだけで全実験が自動的に追跡される。

## torch.jit.script の適用

2 番目のアップグレード。SAC アクターの `select_action` パスが推論時間のボトルネックだ。`torch.jit.script` でコンパイルすると Python インタープリタのオーバーヘッドを排除できる。

3 つの変更が必要だった:

**1. Optional 型ヒントの削除**

```python
# 変更前 (jit.script 不可)
def forward(self, state: torch.Tensor, deterministic: bool = False) -> tuple[torch.Tensor, Optional[torch.Tensor]]:
    ...

# 変更後
def forward(self, state: torch.Tensor, deterministic: bool = False) -> tuple[torch.Tensor, torch.Tensor]:
    ...
```

**2. `torch.distributions` → 手動計算**

```python
# 変更前
dist = Normal(mu, std)
action = dist.rsample()
log_prob = dist.log_prob(action)

# 変更後 (jit.script 対応)
eps = torch.randn_like(mu)
raw = mu + std * eps
action = torch.tanh(raw)
log_prob = (
    -0.5 * (eps.pow(2) + 2 * self.log_std + math.log(2 * math.pi))
    - torch.log(1 - action.pow(2) + 1e-6)
).sum(-1, keepdim=True)
```

**3. スクリプト化**

```python
actor = SACActorScriptable(state_dim=obs_dim, action_dim=act_dim, hidden=256)
scripted_actor = torch.jit.script(actor)
torch.jit.save(scripted_actor, "cache/models/rl/stat_pair/actor_scripted.pt")
```

## 速度測定結果

CPU でのバッチサイズ別 `select_action` レイテンシ:

| バッチサイズ | 通常アクター | Scripted アクター | 速度向上 |
|-----------|-----------|---------------|--------|
| 1 | 0.847ms | 0.398ms | **×2.13** |
| 8 | 1.203ms | 0.841ms | ×1.43 |
| 32 | 2.156ms | 1.897ms | ×1.14 |
| 128 | 6.843ms | 6.334ms | ×1.08 |

バッチサイズが大きくなるほど効果が薄れる。Python オーバーヘッドが全体の実行時間に占める割合が小さくなるためだ。しかしリアルタイム推論（バッチ=1）での ×2.13 は意味のある数値だ。

## GPU ではどうか

GPU ではほぼ差がなかった。CUDA カーネルの実行オーバーヘッドが Python インタープリタのオーバーヘッドを圧倒するためだ。`torch.jit.script` のメリットは主に CPU 推論に集中する。

## 2 つの変更のシナジー

MLflow で全実験を追跡し、scripted アクターで推論速度を上げると、開発サイクル全体が速くなる。より速い推論 → より多くのエピソード → より多くの実験データ → MLflow により多くの記録。

opt-in 設計のおかげで両変更とも既存のコードに触れない。`MLFLOW_TRACKING_URI` を設定しなければ MLflow は完全な no-op。scripted アクターを使わなければ既存のアクターがそのまま動作する。

## まとめ

2 つのアップグレードはどちらも「必要なときにオンにする」方式で設計した。この原則が重要だと思う — 実験インフラはコアロジックに侵入すべきではない。トラッカーは no-op ラッパーとして、JIT コンパイルはオプショナルな保存・読み込みとして。それぞれ独立して使え、合わせて使うとシナジーが生まれる。
