---
title: "Building a Production RAG + Multi-Agent System with LangGraph"
subtitle: "8-node StateGraph with HyDE, cross-encoder reranking, RL bandit retriever selection, Self-RAG loops, and a supervisor-routed multi-agent layer. The full architecture behind ChatBout AI."
date: "2026-04-28"
tags: ["LangGraph", "RAG", "Multi-Agent", "LangChain", "Python", "FastAPI", "LLM"]
summary: "A walkthrough of the ChatBout AI backend: an 8-node LangGraph RAG pipeline (classify, query_transform, retrieve, rerank, grade, generate, hallucination_check) plus a supervisor-pattern multi-agent system that chains RAG, Code, Analysis, and Chitchat agents. Covers HyDE query expansion, cross-encoder reranking (FAISS top-20 to ms-marco-MiniLM top-4), RL Thompson Sampling for retriever auto-selection, Self-RAG grounding loops, RAGAS evaluation, and 11 FastAPI endpoints deployed with Docker."
---

> **TL;DR.** ChatBout AI is a document QA system with two LangGraph
> graphs: (1) an 8-node Advanced RAG pipeline with HyDE, cross-encoder
> reranking, RL bandit retriever selection, and Self-RAG hallucination
> guards; (2) a supervisor-pattern multi-agent system that chains
> specialist workers for complex queries. 11 FastAPI endpoints, Docker
> deployment, LangSmith tracing, RAGAS evaluation. This post walks
> through every node, with code from the actual production system.

---

## 0. Why two graphs

Most RAG tutorials show a three-step chain: embed, retrieve, generate.
That works for demos. In production, I hit three problems that a simple
chain cannot solve:

| Problem | What breaks |
|---------|------------|
| Low-quality retrieval | FAISS returns 20 chunks; half are irrelevant |
| Hallucinated answers | LLM invents facts not in any retrieved document |
| Mixed query types | "Hello" should not trigger a 2-second retrieval pipeline |

The fix is two separate LangGraph `StateGraph` instances:

1. **RAG Graph** (7 processing nodes + conditional edges) -- handles
   document retrieval and grounded generation
2. **Multi-Agent Graph** (supervisor + 4 workers + aggregator) -- routes
   queries to the right specialist

Both graphs share the same FastAPI process and MongoDB user document store.

---

## 1. RAG Pipeline Architecture

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

The state object flows through every node:

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

Every node is wrapped with a timing decorator that records per-node
latency into `node_timings`:

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

## 2. Node-by-Node Breakdown

### 2.1 classify -- Intent routing

The first node decides whether the question needs document retrieval
(`rag`) or is just small talk (`chitchat`). This saves the full
retrieval pipeline for greetings like "Hello" or "Thanks."

```python
CLASSIFY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Classify the question as 'rag' (needs document retrieval) or "
     "'chitchat' (greeting/small talk). Reply ONLY 'rag' or 'chitchat'."),
    ("human", "{question}"),
])
```

Conditional edge after classify:

```python
def route_after_classify(state: dict) -> str:
    return "query_transform" if state.get("route") == "rag" else "generate"
```

### 2.2 query_transform -- HyDE + Multi-Query Expansion

Hypothetical Document Embedding (Gao et al. 2022) generates a
*hypothetical answer* that a perfect document would contain, then uses
that as an additional search query. This bridges the vocabulary gap
between user questions and document language.

```python
QUERY_TRANSFORM_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "Generate 3 alternative search queries for the question, plus a "
     "hypothetical short answer (HyDE) that a perfect document would contain.\n"
     'Reply in JSON: {{"queries": ["q1","q2","q3"], "hyde_answer": "..."}}'),
    ("human", "{question}"),
])
```

The node parses the JSON and concatenates: original question + 3
alternative queries + HyDE answer = 5 search queries total.

```python
all_q = [question] + queries + ([hyde] if hyde else [])
# => ["What is X?", "Explain X", "How does X work?", "Define X", "X is a..."]
```

### 2.3 retrieve -- FAISS + MMR with RL Bandit

Retrieval runs each of the 5 queries through a FAISS vector store
with **MMR (Maximal Marginal Relevance)** -- this balances relevance
with diversity so near-duplicate chunks don't dominate.

```python
def search_mmr(self, query: str, k: int = 8, fetch_k: int = 20):
    return self._store.max_marginal_relevance_search(
        query, k=k, fetch_k=fetch_k
    )
```

The embeddings use `CacheBackedEmbeddings` to avoid redundant API calls:

```python
def _get_cached_embeddings():
    from langchain_classic.embeddings.cache import CacheBackedEmbeddings
    from langchain_classic.storage.file_system import LocalFileStore

    store = LocalFileStore(cache_dir)
    return CacheBackedEmbeddings.from_bytes_store(
        underlying, store, namespace=getattr(underlying, "model", "local")
    )
```

**RL Retriever Selection.** Before retrieval, a Thompson Sampling bandit
selects which retriever to use (FAISS, BM25, or hybrid). The bandit
maintains `Beta(alpha, beta)` posteriors for each arm and updates them
based on downstream relevance scores:

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

The reward signal comes from the `grade` node downstream -- it measures
what fraction of retrieved documents were actually relevant. Over time,
the bandit learns which retriever works best for the user's document
collection.

### 2.4 rerank -- Cross-Encoder Two-Stage Retrieval

FAISS returns top-20 candidates (fast, approximate). The cross-encoder
then re-scores each `(query, document)` pair jointly and keeps only the
top-4. This is the standard two-stage pattern: bi-encoder for recall,
cross-encoder for precision.

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

The pipeline: FAISS top-20 --> ms-marco-MiniLM cross-encoder --> top-4.

### 2.5 grade -- LLM Relevance Grading + Bandit Update

Each surviving document gets a binary relevance judgment from the LLM:

```python
GRADE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Is this document relevant to the question? "
     "Reply ONLY 'relevant' or 'irrelevant'."),
    ("human", "Question: {question}\n\nDocument: {document}"),
])
```

The relevance score (fraction of relevant docs) feeds back into the
bandit:

```python
score = len(relevant) / max(len(docs), 1)
_bandit.update(state.get("retriever_used", "faiss"), min(score, 1.0))
```

If zero documents are relevant and retries remain, the graph loops back
to `query_transform` with a different query formulation.

### 2.6 generate -- Grounded Answer

Standard context-stuffing generation. The prompt explicitly constrains
the LLM to use only the provided context:

```python
GENERATE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Answer using ONLY the context below. If insufficient, say so."
     "\n\nContext:\n{context}"),
    ("human", "{question}"),
])
```

### 2.7 hallucination_check -- Self-RAG Loop

Based on Self-RAG (Asai et al. 2023), this node checks whether the
generated answer is actually grounded in the retrieved documents:

```python
HALLUCINATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Is this answer fully grounded in the documents? "
     "Reply ONLY 'grounded' or 'hallucinated'."),
    ("human", "Documents:\n{documents}\n\nAnswer:\n{answer}"),
])
```

If hallucinated and retries remain, the graph loops back to `generate`
for another attempt. The conditional edge:

```python
def route_after_hallucination(state: dict) -> str:
    if state.get("hallucination_score", 1.0) >= 0.5:
        return "end"
    if state.get("retry_count", 0) < state.get("max_retries", 2):
        return "generate"
    return "end"
```

---

## 3. Building the Graph

Wiring all nodes together in LangGraph:

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

## 4. Multi-Agent System (Supervisor Pattern)

For queries that don't fit pure document retrieval -- "write me a
Python script for X" or "compare these two approaches" -- the system
uses a second LangGraph with the supervisor pattern.

```
         +--------------+
         |  Supervisor  | <-- question
         +------+-------+
                |
    +-----------+-----------+-----------+
    |           |           |           |
 RAG Agent  Code Agent  Analysis   Chitchat
    |           |        Agent      Agent
    +-----------+-----------+-----------+
                |
          +-----+-----+
          | Aggregator |  <-- combines multi-hop responses
          +-----+------+
                |
               END
```

### 4.1 Supervisor -- The Router

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

The supervisor parses the response into an agent sequence:

```python
agents = [a.strip() for a in result.split(",")]
valid = [a for a in agents if a in ("rag", "code", "analysis", "chitchat")]
```

### 4.2 Multi-Hop Chaining

Complex queries can route through 2+ agents sequentially. For example,
"find the relevant docs and then write code based on them" produces
`["rag", "code"]`. Each agent receives the previous agent's response
in its prompt:

```python
def _format_previous(state: dict) -> str:
    responses = state.get("responses", {})
    if not responses:
        return "(none)"
    return "\n\n".join(f"[{a}]: {r[:500]}" for a, r in responses.items())
```

The routing logic after each agent:

```python
def route_after_agent(state: dict) -> str:
    sequence = state.get("agent_sequence", [])
    hop = state.get("hop_count", 0) + 1
    if hop < len(sequence) and hop < state.get("max_hops", 3):
        return "next_hop"
    return "aggregator"
```

### 4.3 Aggregator

When multiple agents contribute, the aggregator combines their
responses:

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

### 4.4 Building the Multi-Agent Graph

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

## 5. Production: FastAPI Endpoints

11 endpoints total across two routers:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/langgraph/health` | Pipeline status + feature flags |
| GET | `/langgraph/metrics` | Aggregated monitoring dashboard |
| GET | `/langgraph/bandit` | RL bandit arm statistics |
| POST | `/langgraph/invoke` | Full RAG pipeline (JSON) |
| POST | `/langgraph/chat` | NDJSON streaming per-node events |
| POST | `/langgraph/agent` | Multi-agent with supervisor |
| POST | `/langgraph/evaluate` | Batch RAGAS evaluation |
| POST | `/question` | Legacy extractive QA |
| GET | `/jobs/health` | Job search agent health |
| POST | `/jobs/search` | Job search RAG agent |
| POST | `/jobs/detail` | Job detail retrieval |

The streaming endpoint is particularly useful for debugging -- it emits
NDJSON events as each graph node completes:

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

## 6. Monitoring and Observability

### Per-Node Latency

Every node records its execution time via `_timed()`. The `/metrics`
endpoint returns aggregated statistics:

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

### LangSmith Tracing

Setting `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY` enables
full LangSmith tracing. Every LangGraph node, every LLM call, every
retrieval shows up as a span in the LangSmith UI. No code changes
needed -- LangChain instruments automatically.

---

## 7. RAGAS Evaluation

The system includes both online and offline evaluation:

**Online** -- single-query evaluation via the `/invoke` endpoint:

```python
def evaluate_single(self, question, answer, contexts):
    dataset = Dataset.from_list([{
        "question": question, "answer": answer, "contexts": contexts,
    }])
    result = ragas_evaluate(dataset, metrics=[faithfulness, answer_relevancy])
    return {k: round(v, 4) for k, v in result.items()}
```

**Offline** -- Gold-standard evaluation script:

```bash
# 1. Start server
uvicorn main:app --port 8000

# 2. Replay golden set
python scripts/run_golden_set.py \
    --golden-set scripts/golden_set.jsonl \
    --output runs/golden_result.jsonl \
    --token $JWT_TOKEN

# 3. Run RAGAS evaluation
python scripts/eval_ragas.py \
    --input runs/golden_result.jsonl
```

Output:

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

The eval script also breaks down scores by category (factual,
procedural, comparative), making it easy to identify weak spots.

---

## 8. Deployment

Docker deployment with health checks:

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

Environment variables:

```bash
ANTHROPIC_API_KEY=sk-...        # or OPENAI_API_KEY
LANGCHAIN_TRACING_V2=true       # LangSmith (optional)
LANGCHAIN_API_KEY=ls-...        # LangSmith key
RAG_RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
RAG_EMBEDDING_CACHE_DIR=./cache/embeddings
```

---

## 9. Lessons Learned

**HyDE is underrated.** When the user asks "how do I configure X" but
the docs say "X configuration requires setting Y and Z," a direct
embedding search misses the match. The hypothetical answer "To configure
X, set Y and Z in the config file" bridges the gap.

**Cross-encoder reranking is the highest-ROI improvement.** Going from
"FAISS top-4" to "FAISS top-20, then cross-encoder top-4" improved
context precision by approximately 23% in my RAGAS evaluations.

**The bandit converges fast.** After approximately 50 queries, the Thompson Sampling
bandit reliably picks FAISS for semantic queries and BM25 for
keyword-heavy queries. The hybrid arm wins when document collections
have mixed technical/natural language.

**Self-RAG retries are rare but valuable.** Only approximately 8% of queries
trigger the hallucination retry loop. But those 8% are exactly the
queries where the LLM would have invented an answer -- the ones that
erode user trust.

**Streaming node events are essential for debugging.** The NDJSON
endpoint shows exactly where time is spent. A slow `rerank` node (cross-
encoder loading on first request) is immediately visible.

---

## 10. What's Next

- **Persistent bandit state** -- currently resets on restart; plan to
  serialize to Redis
- **Async cross-encoder** -- the reranker is synchronous; wrapping it
  in `asyncio.to_thread()` would free the event loop
- **Evaluation-driven prompt tuning** -- using RAGAS scores as the
  objective function for automated prompt optimization
- **Agent tool use** -- giving the code agent access to a sandboxed
  Python REPL for verified execution

---

*The full source is in the ChatBout AI repository. The RAG pipeline is
in `api/langgraph_rag.py` (723 lines), the multi-agent system is in
`api/multi_agent.py` (407 lines), and the FastAPI router is in
`api/langgraph_controller.py` (229 lines).*
