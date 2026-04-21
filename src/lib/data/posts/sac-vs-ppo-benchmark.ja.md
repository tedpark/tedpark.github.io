---
title: "同じペア、異なるアルゴリズム — 公正な SAC vs PPO ベンチマークハーネス"
subtitle: "'SAC を選んだ' という答えが 'SAC を使った' より優れている理由。面接で通用する 3 シード比較の構築。"
date: "2026-04-14"
tags: ["強化学習", "PPO", "SAC", "ベンチマーク", "Python"]
summary: "4 年間 SAC を使い続けてきた。なぜかと聞かれると、正直な答えは「最初にうまくいったから」だった。その答えは面接では通らない。PPO をゼロから実装し（Clipped Objective + GAE(λ) + KL early-stop + Tanh-squashed Gaussian）、SAC と同じ環境で 3 シード比較を行った過程を記録した。結果は数字だけでなく、防御可能な設計の根拠だ。"
lang: ja
---

> **TL;DR** PPO をゼロから実装して SAC と公正な比較を行った。おもちゃの MDP で SAC は +0.191±0.004、PPO は +0.214±0.071。ウォールタイムは SAC 28.3 秒 vs PPO 0.9 秒（×30 高速化）。どちらも収束する。選択は状況による。

## なぜこの実験が必要だったか

4 年前、ペアトレーディングプロジェクトを始めたとき SAC を選んだ理由は単純だった。最初に試して、最初に収束した。PPO も試したが、ハイパーパラメータを十分に調整せずに諦めた。以来、SAC がデフォルトになった。

問題は「なぜ SAC を使ったのか？」という質問への正直な答えが「最初にうまくいったから」だということだ。これは良い答えではない。特に on-policy vs off-policy のトレードオフ、サンプル効率、確率的実行環境での分散を理解している面接官の前では。

そこで午後一杯を使って PPO をゼロから実装した。同じ環境、同じシード、公正な比較。

## 環境設定

`StatPairRLEnv` は両アルゴリズムで同一のものを使用した。ペアトレーディングの核心ロジックを実装したカスタム Gym 環境で、観測値はスプレッドの z-score、ポジション、含み損益だ。

```python
env = StatPairRLEnv(
    pair=("SPY", "IVV"),
    window=60,
    transaction_cost=0.001,
)
```

両アルゴリズムとも同じランダムシード 3 つ（`[42, 123, 777]`）で実行した。シードごとに独立した環境インスタンスを使用した。

## PPO 実装: 主要コンポーネント

PPO をゼロから実装する際に重要な 4 つのコンポーネントがある。

### 1. Clipped Surrogate Objective

```python
ratio = (log_probs - old_log_probs).exp()
surr1 = ratio * advantages
surr2 = ratio.clamp(1 - self.eps_clip, 1 + self.eps_clip) * advantages
policy_loss = -torch.min(surr1, surr2).mean()
```

`eps_clip=0.2` は PPO 論文のデフォルト値だ。クリッピングはポリシー更新を安定させる核心的な仕組みだ。

### 2. GAE(λ) — Generalized Advantage Estimation

```python
def compute_gae(rewards, values, dones, gamma=0.99, lam=0.95):
    advantages = []
    gae = 0.0
    for t in reversed(range(len(rewards))):
        delta = rewards[t] + gamma * values[t+1] * (1 - dones[t]) - values[t]
        gae = delta + gamma * lam * (1 - dones[t]) * gae
        advantages.insert(0, gae)
    return torch.tensor(advantages, dtype=torch.float32)
```

`λ=0.95` は分散・バイアストレードオフのバランス点だ。λ=1 なら Monte Carlo、λ=0 なら 1-step TD。

### 3. KL Early-Stop

```python
approx_kl = ((old_log_probs - log_probs).exp() - 1 - (old_log_probs - log_probs)).mean()
if approx_kl > self.target_kl * 1.5:
    break  # エポックループを中断
```

PPO-Clip だけでも十分安定しているが、KL early-stop は特に連続行動空間で追加の安全網となる。

### 4. Tanh-Squashed Gaussian Policy

```python
class PPOActor(nn.Module):
    def forward(self, state):
        mu = self.mean_net(state)
        log_std = self.log_std_net(state).clamp(-4, 2)
        dist = Normal(mu, log_std.exp())
        raw = dist.rsample()
        action = torch.tanh(raw)
        log_prob = dist.log_prob(raw) - torch.log(1 - action.pow(2) + 1e-6)
        return action, log_prob.sum(-1)
```

SAC と同一のポリシー構造を使用した。この点が特に重要だ — ポリシーの表現力を揃えなければ公正な比較にならない。

## ベンチマークハーネス

```python
class BenchmarkHarness:
    def __init__(self, seeds: list[int], n_episodes: int = 500):
        self.seeds = seeds
        self.n_episodes = n_episodes
    
    def run(self, agent_class, env_factory, **kwargs):
        results = []
        wall_times = []
        
        for seed in self.seeds:
            env = env_factory(seed=seed)
            agent = agent_class(env=env, seed=seed, **kwargs)
            
            t0 = time.perf_counter()
            episode_rewards = agent.train(n_episodes=self.n_episodes)
            elapsed = time.perf_counter() - t0
            
            results.append(np.mean(episode_rewards[-50:]))  # 最後の50エピソード
            wall_times.append(elapsed)
        
        return {
            "mean": np.mean(results),
            "std": np.std(results),
            "wall_time_mean": np.mean(wall_times),
        }
```

公平性のため、両アルゴリズムとも:
- 同一のネットワークサイズ（256-256 hidden units）
- 同一の学習率（3e-4）
- 同一のエピソード数（500）
- 同一のシード

## 結果

| アルゴリズム | 平均報酬 | 標準偏差 | ウォールタイム |
|------------|--------|---------|------------|
| SAC | +0.191 | ±0.004 | 28.3s |
| PPO | +0.214 | ±0.071 | 0.9s |

数字の解釈:
- **報酬**: PPO が SAC をわずかに上回る。ただし標準偏差が大きい（0.071 vs 0.004）。
- **速度**: PPO が ×30 速い。On-policy はリプレイバッファがなく GPU 同期オーバーヘッドも少ない。
- **安定性**: SAC がはるかに安定している。3 シード間のばらつきがほぼない。

## どちらをいつ選ぶか

この実験から得た実用的な結論:

**SAC を選ぶべきとき:**
- サンプル効率が重要なとき（実際の取引環境、シミュレーションコストが高いとき）
- 安定した再現可能な結果が必要なとき
- 4 年間検証されたコードベースに統合するとき

**PPO を検討すべきとき:**
- シミュレーションが速いとき（×30 の速度優位を活かせる）
- 訓練速度自体が重要なメトリクスのとき
- よりシンプルな実装が必要なとき（off-policy より PPO が理論的に直感的）

## 結論

「なぜ SAC を使ったのか？」への答えが変わった。今はこう答えられる: 「SAC と PPO を同じ環境で 3 シード比較し、SAC は標準偏差 0.004 で安定的に収束する一方、PPO は ×30 速いが分散が 17 倍高い。実際の取引では安定性が速度より重要だったため SAC を選んだ。」

これが防御可能な設計の根拠だ。数字があり、トレードオフが明確で、文脈がある。ベンチマークコードは [GitHub](https://github.com/tedpark) で公開している。
