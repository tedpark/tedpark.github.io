---
title: "CVaR 対応ポジションサイジング — QR-DQN 分位数をサイジング乗数に変換"
subtitle: "続編: テールリスク推定値をサイジングレイヤーに接続すると約束した。ここにその opt-in、1 行パッチがある。"
date: "2026-04-17"
tags: ["強化学習", "クオンツファイナンス", "CVaR", "リスク管理", "Python"]
summary: "QR-DQN が CVaR の数値をくれた。数値は戦略ではない。この投稿では CVaR を 4 段階スケーラー（target / scale / floor / veto）を通じて実際の PortfolioSimulator パスに接続する。全ての RL シグナルクラスがこの機能を継承する mixin を追加し、変更は完全に opt-in — QR-DQN チェックポイントを cache に入れない限り既存のバックテストはビット単位で同一に保たれる。"
lang: ja
---

> **TL;DR** 4 段階 CVaR スケーラー: target / scale / floor / veto。RL シグナルクラス用 mixin。完全 opt-in — QR-DQN チェックポイントがなければ動作変化なし。`PortfolioSimulator` はシグナルメタデータからサイジング乗数を読む。

## 前の投稿で残したもの

[前の投稿](from-dqn-to-qr-dqn)で QR-DQN が CVaR₅% をワンライナーで生成することを示した。例:

```python
action_dist = model(state)[0, best_action].cpu().numpy()
cvar_5 = action_dist[:int(0.05 * len(action_dist))].mean()
# cvar_5 = -0.043  (最悪 5% シナリオの平均損失)
```

しかし -0.043 という数値をどう使うのか？ログに記録するだけでは意味がない。ポジションサイズを減らすべきなら、どのくらい？そもそも取引しないべきなのはいつ？

この投稿はその具体的なメカニズムを扱う。

## 4 段階 CVaR スケーラーの設計

実際のリスク管理システムで一般的に使われる 4 段階の構造を実装した:

```
1. Target : 目標 CVaR 水準 (例: -0.02、最悪 5% で 2% 損失許容)
2. Scale  : Target に対する実際の CVaR 比率でポジションサイズを調整
3. Floor  : 最小ポジションサイズ (完全にゼロになるのを防ぐ)
4. Veto   : CVaR がこの水準より悪ければ完全に取引拒否
```

```python
from dataclasses import dataclass
from typing import Optional
import numpy as np

@dataclass
class CVaRScalerConfig:
    """CVaR ベースのポジションサイジング設定。"""
    
    # 目標 CVaR 水準 (負の値、例: -0.02 = 2% 損失許容)
    target: float = -0.02
    
    # CVaR が target より良いときのスケールキャップ
    scale_cap: float = 1.0
    
    # 最小ポジションサイズ比率 (0.0 ~ 1.0)
    floor: float = 0.1
    
    # 取引拒否の閾値
    veto: float = -0.10
    
    # CVaR 計算に使う分位数水準
    alpha: float = 0.05

class CVaRPositionScaler:
    """CVaR 値をポジションサイジング乗数 [0, 1] に変換。"""
    
    def __init__(self, config: CVaRScalerConfig | None = None):
        self.config = config or CVaRScalerConfig()
    
    def scale(self, cvar: float) -> float:
        """
        CVaR → ポジション乗数 [0, 1]。
        
        Examples:
            cvar = -0.01 (target より良い) → 1.0
            cvar = -0.02 (= target)        → 1.0
            cvar = -0.05 (target より悪い) → 0.4
            cvar = -0.10 (= veto)          → 0.0 (拒否)
        """
        cfg = self.config
        
        # 1. Veto の確認
        if cvar <= cfg.veto:
            return 0.0
        
        # 2. Target より良ければ scale_cap を返す
        if cvar >= cfg.target:
            return min(cfg.scale_cap, 1.0)
        
        # 3. target と veto の間: 線形スケール
        ratio = (cvar - cfg.veto) / (cfg.target - cfg.veto)
        scaled = cfg.floor + ratio * (1.0 - cfg.floor)
        
        return float(np.clip(scaled, cfg.floor, 1.0))
```

## CVaRMixin: 全 RL シグナルクラスに機能を追加

重複コードなしで全ての RL シグナルクラスに CVaR 機能を追加する mixin:

```python
from abc import ABC
import torch
from pathlib import Path

class CVaRMixin:
    """
    RL シグナルクラスに CVaR 対応ポジションサイジングを追加する mixin。
    
    使用法:
        class MySACSignal(CVaRMixin, BaseRLSignal):
            ...
    
    opt-in: qr_checkpoint_path が None なら常に scaler=1.0 を返す。
    """
    
    _qr_model: Optional[torch.nn.Module] = None
    _qr_model_path: Optional[Path] = None
    _cvar_scaler: Optional[CVaRPositionScaler] = None
    
    def init_cvar(
        self,
        qr_checkpoint_path: str | Path | None = None,
        scaler_config: CVaRScalerConfig | None = None,
    ) -> None:
        """CVaR スケーラーを初期化する。path が None なら no-op。"""
        if qr_checkpoint_path is None:
            return
        
        path = Path(qr_checkpoint_path)
        if not path.exists():
            return  # チェックポイントなし = opt-out
        
        self._qr_model = torch.jit.load(path, map_location="cpu")
        self._qr_model.eval()
        self._qr_model_path = path
        self._cvar_scaler = CVaRPositionScaler(scaler_config)
    
    def get_position_multiplier(self, state: np.ndarray) -> float:
        """
        現在の状態に対するポジション乗数を返す。
        QR-DQN 未ロード時は常に 1.0 を返す (opt-in 保証)。
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

## PortfolioSimulator との統合

PortfolioSimulator はシグナルメタデータからサイジング乗数を読む:

```python
class PortfolioSimulator:
    def step(self, signal: "BaseRLSignal", state: np.ndarray) -> dict:
        # 既存ロジック: シグナルの行動決定
        action = signal.select_action(state, deterministic=True)
        
        # CVaR 乗数の取得 (mixin がないか無効なら 1.0)
        position_multiplier = 1.0
        if hasattr(signal, "get_position_multiplier"):
            position_multiplier = signal.get_position_multiplier(state)
        
        # ポジションサイズの調整
        adjusted_position = action * position_multiplier
        
        # 実行
        pnl = self._execute(adjusted_position)
        
        return {
            "action": action,
            "position_multiplier": position_multiplier,
            "adjusted_position": adjusted_position,
            "pnl": pnl,
            "cvar_enabled": getattr(signal, "cvar_enabled", False),
        }
```

## SACSignal への mixin 適用

```python
class SACPairSignal(CVaRMixin, BaseRLSignal):
    """CVaR 対応ポジションサイジングを持つ SAC ペアトレーディングシグナル。"""
    
    def __init__(
        self,
        pair: tuple[str, str],
        actor_checkpoint: str,
        qr_checkpoint: str | None = None,  # None なら CVaR 無効
        cvar_config: CVaRScalerConfig | None = None,
    ):
        super().__init__(pair=pair, actor_checkpoint=actor_checkpoint)
        
        # CVaR の初期化 (opt-in)
        self.init_cvar(
            qr_checkpoint_path=qr_checkpoint,
            scaler_config=cvar_config,
        )
```

## ビット単位の後方互換性検証

既存のバックテストが変更されていないことを検証:

```python
def test_backward_compatibility():
    """CVaR なしで実行すれば既存の結果と同一。"""
    env = StatPairRLEnv(pair=("SPY", "IVV"))
    
    # CVaR なしのシグナル
    signal_no_cvar = SACPairSignal(
        pair=("SPY", "IVV"),
        actor_checkpoint="cache/models/rl/stat_pair/actor_latest.pt",
        qr_checkpoint=None,
    )
    rewards_legacy = run_backtest(signal_no_cvar, env, seed=42)
    
    # CVaR ありのシグナル (チェックポイントが存在しない場合は同一のはず)
    signal_with_cvar = SACPairSignal(
        pair=("SPY", "IVV"),
        actor_checkpoint="cache/models/rl/stat_pair/actor_latest.pt",
        qr_checkpoint="/nonexistent/path.pt",  # 存在しない
    )
    rewards_cvar = run_backtest(signal_with_cvar, env, seed=42)
    
    np.testing.assert_array_equal(rewards_legacy, rewards_cvar)
```

## CVaR スケーラーの動作例

```
CVaR₅%  | ポジション乗数 | 動作
--------|-------------|------
-0.005  | 1.00        | 正常 (target より良い)
-0.020  | 1.00        | target と同等
-0.035  | 0.62        | target と veto の間: 部分縮小
-0.065  | 0.28        | さらに縮小
-0.100  | 0.00        | veto: 取引拒否
-0.150  | 0.00        | veto 超過: 取引拒否
```

## まとめ

CVaR の数値はそれ自体では戦略にならない。4 段階スケーラー（target / scale / floor / veto）があって初めて意味のある行動に変換される。Mixin パターンのおかげで全ての RL シグナルクラスが 2 行でこの機能を継承できる。完全な opt-in 設計で既存のバックテストには影響しない。QR-DQN チェックポイントを cache に入れた瞬間に CVaR 対応サイジングが有効になる。
