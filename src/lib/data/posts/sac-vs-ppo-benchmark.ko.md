---
title: "같은 페어, 다른 알고리즘 — 공정한 SAC vs PPO 벤치마크 하네스"
subtitle: "왜 'SAC를 선택했다'는 답이 'SAC를 사용했다'보다 나은가. 면접을 견딜 수 있는 3-시드 비교 구축."
date: "2026-04-14"
tags: ["강화학습", "PPO", "SAC", "벤치마크", "Python"]
summary: "4년 동안 SAC를 사용했다. 왜냐고 물으면 솔직한 답은 '처음에 잘 됐으니까'뿐이었다. 그 답은 면접에서 통하지 않는다. PPO를 처음부터 구현하고 (Clipped Objective + GAE(λ) + KL early-stop + Tanh-squashed Gaussian), SAC와 같은 환경에서 3-시드 비교를 돌린 과정을 기록했다. 숫자만이 아니라 방어 가능한 설계 결정이 목표였다."
lang: ko
---

> **TL;DR** PPO를 처음부터 구현해서 SAC와 공정한 비교를 했다. 장난감 MDP에서 SAC는 +0.191±0.004, PPO는 +0.214±0.071을 기록했다. 월타임은 SAC 28.3초 vs PPO 0.9초(×30 속도향상). 둘 다 수렴한다. 선택은 상황에 따라 달라진다.

## 왜 이 실험이 필요했나

4년 전, 페어 트레이딩 프로젝트를 처음 시작할 때 SAC를 선택한 이유는 단순했다. 먼저 시도했고, 먼저 수렴했다. PPO도 시도해봤지만 하이퍼파라미터를 충분히 조율하지 않은 채 포기했다. 그 이후로 SAC가 기본값이 됐다.

문제는 "왜 SAC를 사용했나요?"라는 질문에 대한 솔직한 답이 "먼저 됐으니까요"라는 것이다. 이건 좋은 답이 아니다. 특히 on-policy vs off-policy 트레이드오프, 샘플 효율성, 결정론적 실행 환경에서의 분산 같은 개념을 이해하는 면접관 앞에서는.

그래서 하루 오후를 투자해 PPO를 처음부터 구현했다. 같은 환경, 같은 시드, 공정한 비교.

## 환경 설정

`StatPairRLEnv`는 두 알고리즘 모두 동일하게 사용했다. 페어 트레이딩의 핵심 로직을 담은 커스텀 Gym 환경으로, 관찰값은 spread z-score, 포지션, 미실현 손익이다.

```python
env = StatPairRLEnv(
    pair=("SPY", "IVV"),
    window=60,
    transaction_cost=0.001,
)
```

두 알고리즘 모두 동일한 랜덤 시드 3개 (`[42, 123, 777]`)로 실행했다. 시드별로 독립된 환경 인스턴스를 사용했다.

## PPO 구현: 핵심 컴포넌트

PPO를 처음부터 구현할 때 가장 중요한 네 가지 컴포넌트가 있다.

### 1. Clipped Surrogate Objective

```python
ratio = (log_probs - old_log_probs).exp()
surr1 = ratio * advantages
surr2 = ratio.clamp(1 - self.eps_clip, 1 + self.eps_clip) * advantages
policy_loss = -torch.min(surr1, surr2).mean()
```

`eps_clip=0.2`는 PPO 논문의 기본값이다. 클리핑은 정책 업데이트를 안정적으로 유지하는 핵심 장치다.

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

`λ=0.95`는 분산-편향 트레이드오프의 균형점이다. λ=1이면 Monte Carlo, λ=0이면 1-step TD.

### 3. KL Early-Stop

```python
approx_kl = ((old_log_probs - log_probs).exp() - 1 - (old_log_probs - log_probs)).mean()
if approx_kl > self.target_kl * 1.5:
    break  # epoch 루프 중단
```

PPO-Clip만으로도 충분히 안정적이지만, KL early-stop은 특히 연속 행동 공간에서 추가적인 안전망이 된다.

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

SAC와 동일한 정책 구조를 사용했다. 이 부분이 특히 중요하다 — 정책 표현력을 일치시켜야 공정한 비교가 가능하다.

## 벤치마크 하네스

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
            
            results.append(np.mean(episode_rewards[-50:]))  # 마지막 50 에피소드
            wall_times.append(elapsed)
        
        return {
            "mean": np.mean(results),
            "std": np.std(results),
            "wall_time_mean": np.mean(wall_times),
        }
```

공정성을 위해 두 알고리즘 모두:
- 동일한 신경망 크기 (256-256 hidden units)
- 동일한 학습률 (3e-4)
- 동일한 에피소드 수 (500)
- 동일한 시드

## 결과

| 알고리즘 | 평균 보상 | 표준편차 | 월타임 |
|---------|---------|---------|-------|
| SAC | +0.191 | ±0.004 | 28.3s |
| PPO | +0.214 | ±0.071 | 0.9s |

숫자를 해석하면:
- **보상**: PPO가 SAC보다 미세하게 높다. 하지만 표준편차가 훨씬 크다 (0.071 vs 0.004).
- **속도**: PPO가 ×30 빠르다. On-policy는 리플레이 버퍼가 없고 GPU 동기화 오버헤드도 적다.
- **안정성**: SAC가 훨씬 안정적이다. 3 시드 간 분산이 거의 없다.

## 언제 무엇을 선택할까

이 실험에서 얻은 실용적인 결론:

**SAC를 선택해야 할 때:**
- 샘플 효율성이 중요할 때 (실제 거래 환경, 시뮬레이션 비용이 클 때)
- 안정적이고 재현 가능한 결과가 필요할 때
- 4년간 검증된 코드베이스에 통합할 때

**PPO를 고려해야 할 때:**
- 시뮬레이션이 빠를 때 (×30 속도 이점을 활용 가능)
- 훈련 속도 자체가 중요한 메트릭일 때
- 더 단순한 구현이 필요할 때 (off-policy보다 PPO가 이론적으로 더 직관적)

## 결론

"왜 SAC를 사용했나요?"에 대한 답이 바뀌었다. 이제는 이렇게 답할 수 있다: "SAC와 PPO를 같은 환경에서 3-시드 비교했고, SAC가 표준편차 0.004로 안정적으로 수렴하는 반면 PPO는 ×30 빠르지만 분산이 17배 더 높습니다. 실제 거래에서는 안정성이 속도보다 중요했기 때문에 SAC를 선택했습니다."

이게 방어 가능한 설계 결정이다. 숫자가 있고, 트레이드오프가 명확하고, 맥락이 있다. 벤치마크 코드는 [GitHub](https://github.com/tedpark)에 공개되어 있다.
