---
title: "LangGraph로 프로덕션 RAG + Multi-Agent 시스템 구축하기"
subtitle: "8노드 StateGraph에 HyDE, 크로스인코더 리랭킹, RL 밴딧 리트리버 선택, Self-RAG 루프, 그리고 Supervisor 패턴 멀티에이전트까지. ChatBout AI의 전체 아키텍처."
date: "2026-04-28"
tags: ["LangGraph", "RAG", "Multi-Agent", "LangChain", "Python", "FastAPI", "LLM"]
summary: "ChatBout AI 백엔드 상세 설명: 8노드 LangGraph RAG 파이프라인(classify, query_transform, retrieve, rerank, grade, generate, hallucination_check)과 Supervisor 패턴 멀티에이전트 시스템(RAG, Code, Analysis, Chitchat Agent 체이닝). HyDE 쿼리 확장, 크로스인코더 리랭킹(FAISS top-20에서 ms-marco-MiniLM top-4), RL Thompson Sampling 리트리버 자동 선택, Self-RAG 그라운딩 루프, RAGAS 평가, Docker 배포된 11개 FastAPI 엔드포인트를 다룬다."
lang: ko
---

> **TL;DR** ChatBout AI는 두 개의 LangGraph 그래프로 구성된 문서 QA 시스템이다.
> (1) HyDE, 크로스인코더 리랭킹, RL 밴딧 리트리버 선택, Self-RAG 할루시네이션
> 가드를 갖춘 8노드 Advanced RAG 파이프라인. (2) 복잡한 쿼리를 위해 전문
> 워커를 체이닝하는 Supervisor 패턴 멀티에이전트 시스템. 11개 FastAPI
> 엔드포인트, Docker 배포, LangSmith 트레이싱, RAGAS 평가. 이 글은 실제
> 프로덕션 코드와 함께 모든 노드를 설명한다.

---

## 0. 왜 두 개의 그래프인가

대부분의 RAG 튜토리얼은 3단계 체인을 보여준다: 임베딩, 검색, 생성.
데모에서는 작동한다. 프로덕션에서는 단순 체인으로 해결할 수 없는 세 가지
문제에 부딪혔다:

| 문제 | 어디서 깨지나 |
|------|-------------|
| 저품질 검색 | FAISS가 20개 청크를 반환하지만 절반이 무관함 |
| 할루시네이션 | LLM이 검색 문서에 없는 사실을 생성함 |
| 혼합 쿼리 타입 | "안녕하세요"에 2초짜리 검색 파이프라인이 작동해선 안 됨 |

해결책은 별도의 LangGraph `StateGraph` 두 개다:

1. **RAG 그래프** (7개 처리 노드 + 조건부 엣지) -- 문서 검색과 근거 기반 생성
2. **멀티에이전트 그래프** (Supervisor + 4개 워커 + Aggregator) -- 적절한 전문 에이전트로 라우팅

두 그래프는 동일한 FastAPI 프로세스와 MongoDB 사용자 문서 저장소를 공유한다.

---

## 1. RAG 파이프라인 아키텍처

```
              classify
              /      \
         [rag]      [chitchat]
           |              |
    query_transform       |
           |              |
        retrieve          |
           |              |
        rerank            |
           |              |
         grade            |
          / \             |
    [retry]  [pass]       |
       |        \         |
  query_transform \       |
                generate <-+
                   |
           hallucination_check
              /         \
         [grounded]   [hallucinated]
              |           |
             END       generate (retry)
```

모든 노드를 관통하는 상태 객체:

```python
@dataclass
class RAGState:
    question: str = ""
    original_question: str = ""
    transformed_queries: list[str] = field(default_factory=list)
    documents: list[Document] = field(default_factory=list)
    reranked_documents: list[Document] = field(default_factory=list)
    generation: str = ""
    route: Literal["rag", "chitchat"] = "rag"
    relevance_score: float = 0.0
    hallucination_score: float = 0.0
    retriever_used: str = "faiss"
    retry_count: int = 0
    max_retries: int = 2
    node_timings: dict[str, float] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
```

모든 노드는 타이밍 데코레이터로 감싸져 `node_timings`에 노드별 레이턴시를 기록한다:

```python
def _timed(node_name: str, fn, state: dict) -> dict:
    t0 = time.time()
    result = fn(state)
    elapsed_ms = (time.time() - t0) * 1000
    timings = state.get("node_timings", {})
    timings[node_name] = round(elapsed_ms, 1)
    result["node_timings"] = timings
    return result
```

---

## 2. 노드별 상세 분석

### 2.1 classify -- 의도 라우팅

첫 번째 노드는 질문이 문서 검색(`rag`)이 필요한지, 단순 대화(`chitchat`)인지
판단한다. "안녕하세요"나 "감사합니다" 같은 인사에 전체 검색 파이프라인을
실행하지 않도록 한다.

```python
CLASSIFY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Classify the question as 'rag' (needs document retrieval) or "
     "'chitchat' (greeting/small talk). Reply ONLY 'rag' or 'chitchat'."),
    ("human", "{question}"),
])
```

classify 이후 조건부 엣지:

```python
def route_after_classify(state: dict) -> str:
    return "query_transform" if state.get("route") == "rag" else "generate"
```

### 2.2 query_transform -- HyDE + 멀티쿼리 확장

HyDE (Hypothetical Document Embedding, Gao et al. 2022)는 완벽한 문서가
포함할 *가상의 답변*을 생성한 뒤, 이를 추가 검색 쿼리로 사용한다. 사용자
질문과 문서 언어 사이의 어휘 격차를 해소한다.

```python
QUERY_TRANSFORM_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "Generate 3 alternative search queries for the question, plus a "
     "hypothetical short answer (HyDE) that a perfect document would contain.\n"
     'Reply in JSON: {{"queries": ["q1","q2","q3"], "hyde_answer": "..."}}'),
    ("human", "{question}"),
])
```

JSON을 파싱해서 합친다: 원본 질문 + 3개 대안 쿼리 + HyDE 답변 = 총 5개 검색 쿼리.

```python
all_q = [question] + queries + ([hyde] if hyde else [])
# => ["X가 뭔가요?", "X 설명", "X는 어떻게 작동하나요?", "X 정의", "X는..."]
```

### 2.3 retrieve -- FAISS + MMR과 RL 밴딧

5개 쿼리 각각을 FAISS 벡터 스토어에서 **MMR (Maximal Marginal Relevance)**로
검색한다 -- 관련성과 다양성의 균형을 맞춰 중복에 가까운 청크가 지배하지
않도록 한다.

```python
def search_mmr(self, query: str, k: int = 8, fetch_k: int = 20):
    return self._store.max_marginal_relevance_search(
        query, k=k, fetch_k=fetch_k
    )
```

임베딩은 `CacheBackedEmbeddings`를 사용해 중복 API 호출을 방지한다:

```python
def _get_cached_embeddings():
    from langchain_classic.embeddings.cache import CacheBackedEmbeddings
    from langchain_classic.storage.file_system import LocalFileStore

    store = LocalFileStore(cache_dir)
    return CacheBackedEmbeddings.from_bytes_store(
        underlying, store, namespace=getattr(underlying, "model", "local")
    )
```

**RL 리트리버 선택.** 검색 전에 Thompson Sampling 밴딧이 어떤 리트리버를 쓸지
결정한다 (FAISS, BM25, 하이브리드). 밴딧은 각 암(arm)에 대해
`Beta(alpha, beta)` 사후분포를 유지하고, 하류 관련성 점수를 기반으로
업데이트한다:

```python
class RetrievalBandit:
    def __init__(self, arms=None):
        self.arms = arms or ["faiss", "bm25", "hybrid"]
        self._alpha = {arm: 1.0 for arm in self.arms}
        self._beta = {arm: 1.0 for arm in self.arms}

    def select(self) -> str:
        samples = {
            arm: random.betavariate(self._alpha[arm], self._beta[arm])
            for arm in self.arms
        }
        return max(samples, key=samples.get)

    def update(self, arm: str, reward: float) -> None:
        self._alpha[arm] += reward
        self._beta[arm] += (1.0 - reward)
```

보상 신호는 하류 `grade` 노드에서 온다 -- 검색된 문서 중 실제로 관련된
문서의 비율을 측정한다. 시간이 지나면서 밴딧은 사용자 문서 컬렉션에 가장
적합한 리트리버를 학습한다.

### 2.4 rerank -- 크로스인코더 2단계 검색

FAISS는 top-20 후보를 반환한다 (빠르고 근사적). 크로스인코더가
`(쿼리, 문서)` 쌍을 jointly 인코딩하여 점수를 재계산하고 top-4만 유지한다.
표준 2단계 패턴: 바이인코더로 리콜, 크로스인코더로 프리시전.

```python
class CrossEncoderReranker:
    def __init__(self, model_name=None, top_k=4):
        self.model_name = model_name or "cross-encoder/ms-marco-MiniLM-L-6-v2"

    def rerank(self, query: str, docs: list[Document]) -> list[Document]:
        pairs = [(query, d.page_content) for d in docs]
        scores = self._model.predict(pairs)
        scored = sorted(zip(docs, scores), key=lambda x: x[1], reverse=True)
        return [doc for doc, _ in scored[:self.top_k]]
```

파이프라인: FAISS top-20 --> ms-marco-MiniLM 크로스인코더 --> top-4.

### 2.5 grade -- LLM 관련성 평가 + 밴딧 업데이트

살아남은 각 문서에 LLM이 이진 관련성 판단을 내린다:

```python
GRADE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Is this document relevant to the question? "
     "Reply ONLY 'relevant' or 'irrelevant'."),
    ("human", "Question: {question}\n\nDocument: {document}"),
])
```

관련성 점수(관련 문서 비율)가 밴딧에 피드백된다:

```python
score = len(relevant) / max(len(docs), 1)
_bandit.update(state.get("retriever_used", "faiss"), min(score, 1.0))
```

관련 문서가 하나도 없고 재시도 횟수가 남았으면, 그래프가 다른 쿼리
형식으로 `query_transform`으로 되돌아간다.

### 2.6 generate -- 근거 기반 답변

표준 컨텍스트 스터핑 생성. 프롬프트가 LLM에 제공된 컨텍스트만 사용하도록
명시적으로 제한한다:

```python
GENERATE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Answer using ONLY the context below. If insufficient, say so."
     "\n\nContext:\n{context}"),
    ("human", "{question}"),
])
```

### 2.7 hallucination_check -- Self-RAG 루프

Self-RAG (Asai et al. 2023)에 기반하여, 생성된 답변이 실제로 검색된 문서에
근거하는지 확인한다:

```python
HALLUCINATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Is this answer fully grounded in the documents? "
     "Reply ONLY 'grounded' or 'hallucinated'."),
    ("human", "Documents:\n{documents}\n\nAnswer:\n{answer}"),
])
```

할루시네이션이 발생하고 재시도가 남았으면, `generate`로 되돌아가 다시
시도한다. 조건부 엣지:

```python
def route_after_hallucination(state: dict) -> str:
    if state.get("hallucination_score", 1.0) >= 0.5:
        return "end"
    if state.get("retry_count", 0) < state.get("max_retries", 2):
        return "generate"
    return "end"
```

---

## 3. 그래프 구성

모든 노드를 LangGraph로 연결:

```python
def build_rag_graph():
    wf = StateGraph(dict)

    wf.add_node("classify", classify_node)
    wf.add_node("query_transform", query_transform_node)
    wf.add_node("retrieve", retrieve_node)
    wf.add_node("rerank", rerank_node)
    wf.add_node("grade", grade_node)
    wf.add_node("generate", generate_node)
    wf.add_node("hallucination_check", hallucination_check_node)

    wf.set_entry_point("classify")

    wf.add_conditional_edges("classify", route_after_classify,
        {"query_transform": "query_transform", "generate": "generate"})
    wf.add_edge("query_transform", "retrieve")
    wf.add_edge("retrieve", "rerank")
    wf.add_edge("rerank", "grade")
    wf.add_conditional_edges("grade", route_after_grade,
        {"generate": "generate", "query_transform": "query_transform"})
    wf.add_edge("generate", "hallucination_check")
    wf.add_conditional_edges("hallucination_check", route_after_hallucination,
        {"end": END, "generate": "generate"})

    return wf.compile()
```

---

## 4. 멀티에이전트 시스템 (Supervisor 패턴)

순수 문서 검색에 맞지 않는 쿼리 -- "X에 대한 Python 스크립트 작성해줘"
또는 "두 가지 접근법을 비교해줘" -- 를 위해, Supervisor 패턴의 두 번째
LangGraph를 사용한다.

```
         +--------------+
         |  Supervisor  | <-- 질문
         +------+-------+
                |
    +-----------+-----------+-----------+
    |           |           |           |
 RAG Agent  Code Agent  Analysis   Chitchat
    |           |        Agent      Agent
    +-----------+-----------+-----------+
                |
          +-----+-----+
          | Aggregator |  <-- 멀티홉 응답 결합
          +-----+------+
                |
               END
```

### 4.1 Supervisor -- 라우터

```python
SUPERVISOR_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "You are a supervisor that routes questions to specialist agents.\n"
     "Available agents:\n"
     "  - rag: For questions that need document retrieval\n"
     "  - code: For code generation, debugging, or explanation\n"
     "  - analysis: For data analysis, comparison, reasoning\n"
     "  - chitchat: For greetings, small talk\n\n"
     "For complex questions, chain agents: e.g. 'rag,code'\n"
     "Reply with ONLY the agent name(s), comma-separated."),
    ("human", "{question}"),
])
```

Supervisor가 응답을 에이전트 시퀀스로 파싱한다:

```python
agents = [a.strip() for a in result.split(",")]
valid = [a for a in agents if a in ("rag", "code", "analysis", "chitchat")]
```

### 4.2 멀티홉 체이닝

복잡한 쿼리는 2개 이상의 에이전트를 순차적으로 통과할 수 있다. 예를 들어,
"관련 문서를 찾아서 그것을 기반으로 코드를 작성해줘"는 `["rag", "code"]`를
생성한다. 각 에이전트는 이전 에이전트의 응답을 프롬프트에서 받는다:

```python
def _format_previous(state: dict) -> str:
    responses = state.get("responses", {})
    if not responses:
        return "(none)"
    return "\n\n".join(f"[{a}]: {r[:500]}" for a, r in responses.items())
```

각 에이전트 이후의 라우팅 로직:

```python
def route_after_agent(state: dict) -> str:
    sequence = state.get("agent_sequence", [])
    hop = state.get("hop_count", 0) + 1
    if hop < len(sequence) and hop < state.get("max_hops", 3):
        return "next_hop"
    return "aggregator"
```

### 4.3 Aggregator

여러 에이전트가 기여하면, Aggregator가 응답들을 결합한다:

```python
AGGREGATOR_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "You received responses from multiple specialist agents.\n"
     "Combine them into a single coherent answer.\n"
     "Preserve technical details from each agent's contribution.\n\n"
     "Agent responses:\n{agent_responses}"),
    ("human", "{question}"),
])
```

### 4.4 멀티에이전트 그래프 구성

```python
def build_multi_agent_graph():
    wf = StateGraph(dict)

    wf.add_node("supervisor", supervisor_node)
    wf.add_node("rag_agent", rag_agent_node)
    wf.add_node("code_agent", code_agent_node)
    wf.add_node("analysis_agent", analysis_agent_node)
    wf.add_node("chitchat_agent", chitchat_agent_node)
    wf.add_node("next_hop", next_hop_node)
    wf.add_node("aggregator", aggregator_node)

    wf.set_entry_point("supervisor")

    wf.add_conditional_edges("supervisor", route_to_agent, {
        "rag_agent": "rag_agent",
        "code_agent": "code_agent",
        "analysis_agent": "analysis_agent",
        "chitchat_agent": "chitchat_agent",
    })

    for agent in ["rag_agent", "code_agent", "analysis_agent", "chitchat_agent"]:
        wf.add_conditional_edges(agent, route_after_agent,
            {"next_hop": "next_hop", "aggregator": "aggregator"})

    wf.add_conditional_edges("next_hop", route_to_agent, {
        "rag_agent": "rag_agent",
        "code_agent": "code_agent",
        "analysis_agent": "analysis_agent",
        "chitchat_agent": "chitchat_agent",
    })

    wf.add_edge("aggregator", END)
    return wf.compile()
```

---

## 5. 프로덕션: FastAPI 엔드포인트

두 라우터에 걸쳐 총 11개 엔드포인트:

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/langgraph/health` | 파이프라인 상태 + 기능 플래그 |
| GET | `/langgraph/metrics` | 집계된 모니터링 대시보드 |
| GET | `/langgraph/bandit` | RL 밴딧 암 통계 |
| POST | `/langgraph/invoke` | 전체 RAG 파이프라인 (JSON) |
| POST | `/langgraph/chat` | NDJSON 스트리밍 노드별 이벤트 |
| POST | `/langgraph/agent` | Supervisor 기반 멀티에이전트 |
| POST | `/langgraph/evaluate` | 배치 RAGAS 평가 |
| POST | `/question` | 레거시 추출형 QA |
| GET | `/jobs/health` | 채용 검색 에이전트 헬스체크 |
| POST | `/jobs/search` | 채용 검색 RAG 에이전트 |
| POST | `/jobs/detail` | 채용 상세 검색 |

스트리밍 엔드포인트는 디버깅에 특히 유용하다 -- 각 그래프 노드가 완료될
때마다 NDJSON 이벤트를 발행한다:

```python
@router.post("/chat")
async def chat_stream(request: Request, body: ChatRequest):
    async def event_stream():
        async for event in rag_chain.astream(initial_state):
            for node_name, out in event.items():
                payload = {"node": node_name}
                if "generation" in out:
                    payload["answer"] = out["generation"]
                if "node_timings" in out:
                    payload["timings"] = out["node_timings"]
                yield json.dumps(payload) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
```

---

## 6. 모니터링과 관측성

### 노드별 레이턴시

모든 노드가 `_timed()`를 통해 실행 시간을 기록한다. `/metrics` 엔드포인트가
집계된 통계를 반환한다:

```python
class RAGMonitor:
    def record_query(self, relevance, hallucinated, retries, latency_ms, node_timings):
        self.queries_total += 1
        self.avg_latency_ms = self._latency_sum / self.queries_total
        for node, ms in node_timings.items():
            self.node_latencies.setdefault(node, []).append(ms)

    def summary(self):
        return {
            "queries_total": self.queries_total,
            "avg_relevance": round(self.avg_relevance, 3),
            "hallucination_rate": round(
                self.hallucinations_total / max(self.queries_total, 1), 3),
            "node_avg_latency_ms": {
                node: round(sum(t)/len(t), 1) for node, t in self.node_latencies.items()
            },
            "bandit_stats": _bandit.stats(),
        }
```

### LangSmith 트레이싱

`LANGCHAIN_TRACING_V2=true`와 `LANGCHAIN_API_KEY`를 설정하면 완전한
LangSmith 트레이싱이 활성화된다. 모든 LangGraph 노드, 모든 LLM 호출, 모든
검색이 LangSmith UI에 스팬으로 표시된다. 코드 변경 없음 -- LangChain이
자동으로 계측한다.

---

## 7. RAGAS 평가

온라인과 오프라인 평가를 모두 포함한다:

**온라인** -- `/invoke` 엔드포인트를 통한 단일 쿼리 평가:

```python
def evaluate_single(self, question, answer, contexts):
    dataset = Dataset.from_list([{
        "question": question, "answer": answer, "contexts": contexts,
    }])
    result = ragas_evaluate(dataset, metrics=[faithfulness, answer_relevancy])
    return {k: round(v, 4) for k, v in result.items()}
```

**오프라인** -- Gold-standard 평가 스크립트:

```bash
# 1. 서버 시작
uvicorn main:app --port 8000

# 2. Golden set 리플레이
python scripts/run_golden_set.py \
    --golden-set scripts/golden_set.jsonl \
    --output runs/golden_result.jsonl \
    --token $JWT_TOKEN

# 3. RAGAS 평가 실행
python scripts/eval_ragas.py \
    --input runs/golden_result.jsonl
```

출력:

```
--------------------------------------------------------------------
  RAGAS summary  (N=25, mode=real)
--------------------------------------------------------------------
  faithfulness_mean            0.8734
  faithfulness_std             0.1021
  answer_relevancy_mean        0.9112
  answer_relevancy_std         0.0567
  context_precision_mean       0.8456
  context_precision_std        0.0891
  context_recall_mean          0.7823
  context_recall_std           0.1234
--------------------------------------------------------------------
```

평가 스크립트는 카테고리별(사실형, 절차형, 비교형) 점수도 분류하여
취약점을 쉽게 파악할 수 있다.

---

## 8. 배포

헬스체크 포함 Docker 배포:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/langgraph/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

환경 변수:

```bash
ANTHROPIC_API_KEY=sk-...        # 또는 OPENAI_API_KEY
LANGCHAIN_TRACING_V2=true       # LangSmith (선택사항)
LANGCHAIN_API_KEY=ls-...        # LangSmith 키
RAG_RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
RAG_EMBEDDING_CACHE_DIR=./cache/embeddings
```

---

## 9. 교훈

**HyDE는 과소평가되어 있다.** 사용자가 "X는 어떻게 설정하나요"라고 물었는데
문서에는 "X 설정은 Y와 Z를 설정해야 합니다"라고 되어 있을 때, 직접 임베딩
검색으로는 매칭이 안 된다. 가상 답변 "X를 설정하려면 설정 파일에서 Y와 Z를
설정하세요"가 그 격차를 해소한다.

**크로스인코더 리랭킹이 ROI가 가장 높은 개선이다.** "FAISS top-4"에서
"FAISS top-20 후 크로스인코더 top-4"로 바꾸니 RAGAS 평가에서 컨텍스트
프리시전이 약 23% 향상되었다.

**밴딧은 빠르게 수렴한다.** 약 50개 쿼리 후에 Thompson Sampling 밴딧이
시맨틱 쿼리에는 FAISS를, 키워드 중심 쿼리에는 BM25를 안정적으로 선택한다.
하이브리드 암은 기술/자연어가 혼합된 문서 컬렉션에서 승리한다.

**Self-RAG 재시도는 드물지만 가치 있다.** 약 8%의 쿼리만 할루시네이션
재시도 루프를 트리거한다. 하지만 그 8%가 정확히 LLM이 답변을 지어냈을
쿼리들 -- 사용자 신뢰를 깎는 바로 그것이다.

**스트리밍 노드 이벤트는 디버깅에 필수적이다.** NDJSON 엔드포인트가 시간이
어디에 소비되는지 정확히 보여준다. 느린 `rerank` 노드 (첫 요청 시
크로스인코더 로딩)가 즉시 보인다.

---

## 10. 다음 단계

- **밴딧 상태 영속화** -- 현재 재시작 시 초기화됨; Redis에 직렬화 예정
- **비동기 크로스인코더** -- 리랭커가 동기식임; `asyncio.to_thread()`로
  감싸면 이벤트 루프 해방
- **평가 기반 프롬프트 튜닝** -- RAGAS 점수를 자동화된 프롬프트 최적화의
  목적 함수로 활용
- **에이전트 도구 사용** -- Code 에이전트에 샌드박스된 Python REPL 접근
  권한 부여

---

*전체 소스는 ChatBout AI 저장소에 있다. RAG 파이프라인은
`api/langgraph_rag.py` (723줄), 멀티에이전트 시스템은
`api/multi_agent.py` (407줄), FastAPI 라우터는
`api/langgraph_controller.py` (229줄)에 있다.*
