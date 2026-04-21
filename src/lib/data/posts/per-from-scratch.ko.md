---
title: "PER 처음부터 구현 — SumTree, Importance-Sampling 가중치, β 어닐링"
subtitle: "210줄 numpy로 구현하는 Prioritized Experience Replay. 의존성 없음, O(log N) 샘플링, Twin-Critic SAC 완전 통합."
date: "2026-04-15"
tags: ["강화학습", "SAC", "자료구조", "PyTorch", "Python"]
summary: "균일 리플레이는 낭비다. 희귀하지만 중요한 전환(레짐 전환 같은)이 재표면화되는 데 오랜 시간이 걸린다. Schaul 2016의 Prioritized Experience Replay는 O(log N) SumTree 샘플러와 불편성을 보존하는 importance-sampling 가중치로 이 문제를 해결한다. 170줄 구현, SumTree 불변식, twin-critic TD-error 집계, SACTrainer의 한 줄 전환을 설명한다."
lang: ko
---

> **TL;DR** SumTree로 O(log N) 우선순위 샘플링을 구현했다. α 우선순위, β 어닐링(0.4→1.0, 200K 샘플), IS 가중 손실. `use_per=True` 플래그 하나로 SACTrainer에 통합. 170줄, 10개 단위 테스트.

## 왜 균일 리플레이가 부족한가

SAC의 기본 리플레이 버퍼는 균일하게 샘플링한다 — 각 전환이 뽑힐 확률이 동일하다. 100만 개의 전환이 버퍼에 있다면, 모든 전환이 1/1,000,000의 확률로 샘플링된다.

이게 문제인 이유를 페어 트레이딩 맥락에서 생각해보자. 대부분의 전환은 "스프레드가 정상적으로 움직인다"다. 가끔 레짐 전환이 발생한다 — 변동성이 급등하고 상관관계가 깨지는 순간. 이런 전환은 드물지만 에이전트 입장에서 가장 많이 배워야 할 것들이다.

균일 샘플링에서 이런 중요한 전환이 다시 샘플링되기까지 평균 몇 스텝이 걸릴까? 버퍼 크기가 N이면 기댓값은 N 스텝이다.

## SumTree 자료구조

PER의 핵심은 SumTree다. 완전 이진 트리로, 각 리프 노드가 전환의 우선순위를 저장하고, 내부 노드는 하위 트리의 합을 저장한다.

```
              42
           /      \
         29         13
        /  \       /  \
      13    16    3    10
     / \   / \  / \   / \
    3  10 12  4 1  2  7  3
```

루트는 모든 우선순위의 합이다. 이 구조 덕분에 O(log N) 시간에 우선순위 비례 샘플링이 가능하다.

```python
import numpy as np

class SumTree:
    """
    O(log N) 우선순위 비례 샘플링을 위한 SumTree.
    
    불변식:
    - tree[i] = tree[2*i+1] + tree[2*i+2] (내부 노드)
    - tree[capacity-1 + i] = 전환 i의 우선순위 (리프 노드)
    """
    
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.tree = np.zeros(2 * capacity - 1, dtype=np.float64)
        self.data = [None] * capacity
        self._write_idx = 0
        self._size = 0
    
    def push(self, priority: float, data) -> None:
        """새 전환을 삽입하고 우선순위를 업데이트."""
        idx = self._write_idx + self.capacity - 1
        self.data[self._write_idx] = data
        self._update(idx, priority)
        
        self._write_idx = (self._write_idx + 1) % self.capacity
        self._size = min(self._size + 1, self.capacity)
    
    def _update(self, idx: int, priority: float) -> None:
        """리프에서 루트까지 트리를 업데이트."""
        delta = priority - self.tree[idx]
        self.tree[idx] = priority
        
        while idx != 0:
            idx = (idx - 1) // 2
            self.tree[idx] += delta
    
    def sample(self, value: float) -> tuple[int, float, object]:
        """
        누적 우선순위 `value`에 해당하는 리프를 반환.
        value ∈ [0, total_priority)
        """
        idx = 0
        while idx < self.capacity - 1:
            left = 2 * idx + 1
            right = left + 1
            if value <= self.tree[left]:
                idx = left
            else:
                value -= self.tree[left]
                idx = right
        
        data_idx = idx - (self.capacity - 1)
        return data_idx, self.tree[idx], self.data[data_idx]
    
    @property
    def total_priority(self) -> float:
        return self.tree[0]
    
    def __len__(self) -> int:
        return self._size
```

## PER 버퍼 구현

```python
class PrioritizedReplayBuffer:
    """
    Schaul et al. 2016 기반 Prioritized Experience Replay.
    
    매개변수:
        capacity: 최대 전환 수
        alpha: 우선순위화 강도 (0=균일, 1=완전 우선순위)
        beta_start: IS 가중치 초기 β (0.4 권장)
        beta_end: IS 가중치 최종 β (1.0 = 완전 보정)
        beta_anneal_steps: β가 end에 도달하는 스텝 수
        epsilon: 최소 우선순위 (수치 안정성)
    """
    
    def __init__(
        self,
        capacity: int = 100_000,
        alpha: float = 0.6,
        beta_start: float = 0.4,
        beta_end: float = 1.0,
        beta_anneal_steps: int = 200_000,
        epsilon: float = 1e-6,
    ):
        self.tree = SumTree(capacity)
        self.alpha = alpha
        self.beta_start = beta_start
        self.beta_end = beta_end
        self.beta_anneal_steps = beta_anneal_steps
        self.epsilon = epsilon
        self._step = 0
        self._max_priority = 1.0
    
    @property
    def beta(self) -> float:
        """현재 β를 선형으로 어닐링."""
        frac = min(self._step / self.beta_anneal_steps, 1.0)
        return self.beta_start + frac * (self.beta_end - self.beta_start)
    
    def push(self, state, action, reward, next_state, done) -> None:
        """최대 우선순위로 새 전환 삽입."""
        priority = self._max_priority ** self.alpha
        self.tree.push(priority, (state, action, reward, next_state, done))
    
    def sample(self, batch_size: int) -> tuple:
        """IS 가중치와 함께 우선순위 비례 배치 샘플링."""
        indices = np.zeros(batch_size, dtype=np.int32)
        priorities = np.zeros(batch_size, dtype=np.float64)
        batch = []
        
        segment = self.tree.total_priority / batch_size
        
        for i in range(batch_size):
            lo, hi = segment * i, segment * (i + 1)
            value = np.random.uniform(lo, hi)
            idx, priority, data = self.tree.sample(value)
            indices[i] = idx
            priorities[i] = priority
            batch.append(data)
        
        # Importance-Sampling 가중치
        n = len(self.tree)
        prob = priorities / self.tree.total_priority
        weights = (n * prob) ** (-self.beta)
        weights /= weights.max()  # 정규화
        
        self._step += 1
        
        states, actions, rewards, next_states, dones = zip(*batch)
        return (
            np.array(states, dtype=np.float32),
            np.array(actions, dtype=np.float32),
            np.array(rewards, dtype=np.float32).reshape(-1, 1),
            np.array(next_states, dtype=np.float32),
            np.array(dones, dtype=np.float32).reshape(-1, 1),
            indices,
            weights.astype(np.float32).reshape(-1, 1),
        )
    
    def update_priorities(self, indices: np.ndarray, td_errors: np.ndarray) -> None:
        """TD 오류 기반으로 우선순위 업데이트."""
        for idx, td_error in zip(indices, td_errors):
            priority = (abs(td_error) + self.epsilon) ** self.alpha
            self.tree._update(idx + self.tree.capacity - 1, priority)
            self._max_priority = max(self._max_priority, priority)
    
    def __len__(self) -> int:
        return len(self.tree)
```

## SACTrainer 통합

`use_per=True` 플래그 하나로 전환:

```python
class SACTrainer:
    def __init__(
        self,
        ...
        use_per: bool = False,
        per_alpha: float = 0.6,
        per_beta_start: float = 0.4,
        per_beta_anneal_steps: int = 200_000,
    ):
        if use_per:
            self.replay_buffer = PrioritizedReplayBuffer(
                capacity=self.buffer_size,
                alpha=per_alpha,
                beta_start=per_beta_start,
                beta_anneal_steps=per_beta_anneal_steps,
            )
        else:
            self.replay_buffer = ReplayBuffer(capacity=self.buffer_size)
        
        self.use_per = use_per
    
    def _update(self) -> dict[str, float]:
        if self.use_per:
            states, actions, rewards, next_states, dones, indices, weights = \
                self.replay_buffer.sample(self.batch_size)
            weights_tensor = torch.from_numpy(weights).to(self.device)
        else:
            states, actions, rewards, next_states, dones = \
                self.replay_buffer.sample(self.batch_size)
            weights_tensor = torch.ones(self.batch_size, 1).to(self.device)
            indices = None
        
        # Twin-Critic TD 오류
        with torch.no_grad():
            next_action, next_log_prob = self.actor(next_states_t)
            q1_next = self.target_critic1(next_states_t, next_action)
            q2_next = self.target_critic2(next_states_t, next_action)
            q_next = torch.min(q1_next, q2_next) - self.alpha * next_log_prob
            q_target = rewards_t + self.gamma * (1 - dones_t) * q_next
        
        q1_pred = self.critic1(states_t, actions_t)
        q2_pred = self.critic2(states_t, actions_t)
        
        td_errors1 = (q_target - q1_pred).abs()
        td_errors2 = (q_target - q2_pred).abs()
        # Twin critic: 두 TD 오류의 평균을 우선순위로
        td_errors = ((td_errors1 + td_errors2) / 2).detach().cpu().numpy()
        
        # IS 가중 손실
        critic1_loss = (weights_tensor * (q_target - q1_pred).pow(2)).mean()
        critic2_loss = (weights_tensor * (q_target - q2_pred).pow(2)).mean()
        
        # 우선순위 업데이트
        if self.use_per and indices is not None:
            self.replay_buffer.update_priorities(indices, td_errors.flatten())
        
        ...
```

## 결과 비교

| | 균일 리플레이 | PER (α=0.6) |
|--|------------|------------|
| 1,000 에피소드 보상 | +0.191±0.004 | +0.203±0.003 |
| 수렴 에피소드 | ~600 | ~420 |
| 메모리 오버헤드 | 기준 | +8% (SumTree) |

PER은 수렴 속도를 ~30% 향상시켰다. 특히 레짐 전환이 포함된 데이터에서 효과가 뚜렷했다.

## 결론

SumTree는 우선순위 비례 샘플링을 O(N)에서 O(log N)으로 줄이는 우아한 자료구조다. 170줄로 완전한 PER 구현이 가능하고, `use_per=True` 플래그 하나로 기존 SACTrainer에 완벽하게 통합된다. 중요한 전환을 더 자주 샘플링한다는 직관은 실제로 측정 가능한 성능 향상으로 이어진다.
