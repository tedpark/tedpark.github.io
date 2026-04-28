---
title: "LangGraph で本番 RAG + マルチエージェントシステムを構築する"
subtitle: "8 ノード StateGraph に HyDE、クロスエンコーダーリランキング、RL バンディットリトリーバー選択、Self-RAG ループ、そして Supervisor パターンのマルチエージェントまで。ChatBout AI の全アーキテクチャ。"
date: "2026-04-28"
tags: ["LangGraph", "RAG", "Multi-Agent", "LangChain", "Python", "FastAPI", "LLM"]
summary: "ChatBout AI バックエンドの詳細解説: 8 ノード LangGraph RAG パイプライン（classify, query_transform, retrieve, rerank, grade, generate, hallucination_check）と Supervisor パターンのマルチエージェントシステム（RAG, Code, Analysis, Chitchat Agent のチェイニング）。HyDE クエリ拡張、クロスエンコーダーリランキング（FAISS top-20 から ms-marco-MiniLM top-4）、RL Thompson Sampling リトリーバー自動選択、Self-RAG グラウンディングループ、RAGAS 評価、Docker デプロイの 11 FastAPI エンドポイントを解説する。"
lang: ja
---

> **TL;DR** ChatBout AI は 2 つの LangGraph グラフで構成されたドキュメント QA システムだ。
> (1) HyDE、クロスエンコーダーリランキング、RL バンディットリトリーバー選択、
> Self-RAG ハルシネーションガードを備えた 8 ノード Advanced RAG パイプライン。
> (2) 複雑なクエリのためにスペシャリストワーカーをチェイニングする Supervisor
> パターンのマルチエージェントシステム。11 の FastAPI エンドポイント、Docker
> デプロイ、LangSmith トレーシング、RAGAS 評価。本記事では実際の本番コードと
> ともにすべてのノードを解説する。

---

## 0. なぜ 2 つのグラフなのか

多くの RAG チュートリアルは 3 ステップのチェインを示す：埋め込み、検索、
生成。デモでは動く。本番では、単純なチェインでは解決できない 3 つの問題に
ぶつかった：

| 問題 | 何が壊れるか |
|------|------------|
| 低品質な検索 | FAISS が 20 チャンクを返すが半分が無関係 |
| ハルシネーション | LLM が検索ドキュメントにない事実を生成する |
| 混合クエリタイプ | 「こんにちは」で 2 秒の検索パイプラインが起動すべきではない |

解決策は別々の LangGraph `StateGraph` 2 つ：

1. **RAG グラフ**（7 処理ノード + 条件付きエッジ）-- ドキュメント検索と根拠に基づく生成
2. **マルチエージェントグラフ**（Supervisor + 4 ワーカー + Aggregator）-- 適切なスペシャリストにルーティング

両グラフは同じ FastAPI プロセスと MongoDB ユーザードキュメントストアを共有する。

---

## 1. RAG パイプラインアーキテクチャ

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

すべてのノードを流れるステートオブジェクト：

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

すべてのノードはタイミングデコレータでラップされ、`node_timings` にノードごとのレイテンシを記録する：

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

## 2. ノードごとの詳細解説

### 2.1 classify -- インテントルーティング

最初のノードは質問がドキュメント検索（`rag`）を必要とするか、単なる雑談（`chitchat`）かを判断する。「こんにちは」や「ありがとう」のような挨拶で検索パイプライン全体を実行しないようにする。

```python
CLASSIFY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Classify the question as 'rag' (needs document retrieval) or "
     "'chitchat' (greeting/small talk). Reply ONLY 'rag' or 'chitchat'."),
    ("human", "{question}"),
])
```

classify 後の条件付きエッジ：

```python
def route_after_classify(state: dict) -> str:
    return "query_transform" if state.get("route") == "rag" else "generate"
```

### 2.2 query_transform -- HyDE + マルチクエリ拡張

HyDE（Hypothetical Document Embedding, Gao et al. 2022）は完璧なドキュメントが含むであろう*仮想の回答*を生成し、それを追加の検索クエリとして使用する。ユーザーの質問とドキュメントの言語間の語彙ギャップを解消する。

```python
QUERY_TRANSFORM_PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "Generate 3 alternative search queries for the question, plus a "
     "hypothetical short answer (HyDE) that a perfect document would contain.\n"
     'Reply in JSON: {{"queries": ["q1","q2","q3"], "hyde_answer": "..."}}'),
    ("human", "{question}"),
])
```

JSON をパースして結合する：元の質問 + 3 つの代替クエリ + HyDE 回答 = 合計 5 つの検索クエリ。

```python
all_q = [question] + queries + ([hyde] if hyde else [])
# => ["X とは？", "X の説明", "X はどう動作するか？", "X の定義", "X は..."]
```

### 2.3 retrieve -- FAISS + MMR と RL バンディット

5 つのクエリそれぞれを FAISS ベクトルストアで **MMR（Maximal Marginal Relevance）** 検索する -- 関連性と多様性のバランスをとり、ほぼ重複するチャンクが支配しないようにする。

```python
def search_mmr(self, query: str, k: int = 8, fetch_k: int = 20):
    return self._store.max_marginal_relevance_search(
        query, k=k, fetch_k=fetch_k
    )
```

埋め込みは `CacheBackedEmbeddings` を使用して冗長な API コールを防ぐ：

```python
def _get_cached_embeddings():
    from langchain_classic.embeddings.cache import CacheBackedEmbeddings
    from langchain_classic.storage.file_system import LocalFileStore

    store = LocalFileStore(cache_dir)
    return CacheBackedEmbeddings.from_bytes_store(
        underlying, store, namespace=getattr(underlying, "model", "local")
    )
```

**RL リトリーバー選択。** 検索前に Thompson Sampling バンディットがどのリトリーバーを使うか決定する（FAISS、BM25、ハイブリッド）。バンディットは各アーム（arm）に対して `Beta(alpha, beta)` 事後分布を維持し、下流の関連性スコアに基づいて更新する：

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

報酬信号は下流の `grade` ノードから来る -- 検索されたドキュメントのうち実際に関連していた割合を測定する。時間とともにバンディットはユーザーのドキュメントコレクションに最適なリトリーバーを学習する。

### 2.4 rerank -- クロスエンコーダー 2 段階検索

FAISS が top-20 候補を返す（高速、近似的）。クロスエンコーダーが `(クエリ, ドキュメント)` ペアを jointly エンコーディングしてスコアを再計算し、top-4 だけを保持する。標準的な 2 段階パターン：バイエンコーダーでリコール、クロスエンコーダーでプレシジョン。

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

パイプライン：FAISS top-20 --> ms-marco-MiniLM クロスエンコーダー --> top-4。

### 2.5 grade -- LLM 関連性評価 + バンディット更新

生き残った各ドキュメントに LLM が二値の関連性判定を下す：

```python
GRADE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Is this document relevant to the question? "
     "Reply ONLY 'relevant' or 'irrelevant'."),
    ("human", "Question: {question}\n\nDocument: {document}"),
])
```

関連性スコア（関連ドキュメントの割合）がバンディットにフィードバックされる：

```python
score = len(relevant) / max(len(docs), 1)
_bandit.update(state.get("retriever_used", "faiss"), min(score, 1.0))
```

関連ドキュメントがゼロでリトライ回数が残っていれば、グラフは別のクエリ形式で `query_transform` にループバックする。

### 2.6 generate -- 根拠に基づく回答

標準的なコンテキストスタッフィング生成。プロンプトが LLM に提供されたコンテキストのみを使用するよう明示的に制約する：

```python
GENERATE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Answer using ONLY the context below. If insufficient, say so."
     "\n\nContext:\n{context}"),
    ("human", "{question}"),
])
```

### 2.7 hallucination_check -- Self-RAG ループ

Self-RAG（Asai et al. 2023）に基づき、生成された回答が実際に検索されたドキュメントに根拠があるか検証する：

```python
HALLUCINATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", "Is this answer fully grounded in the documents? "
     "Reply ONLY 'grounded' or 'hallucinated'."),
    ("human", "Documents:\n{documents}\n\nAnswer:\n{answer}"),
])
```

ハルシネーションが発生しリトライが残っていれば、`generate` にループバックして再試行する。条件付きエッジ：

```python
def route_after_hallucination(state: dict) -> str:
    if state.get("hallucination_score", 1.0) >= 0.5:
        return "end"
    if state.get("retry_count", 0) < state.get("max_retries", 2):
        return "generate"
    return "end"
```

---

## 3. グラフの構築

すべてのノードを LangGraph で接続する：

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

## 4. マルチエージェントシステム（Supervisor パターン）

純粋なドキュメント検索に適さないクエリ -- 「X の Python スクリプトを書いて」や「2 つのアプローチを比較して」-- のために、Supervisor パターンの 2 つ目の LangGraph を使用する。

```
         +--------------+
         |  Supervisor  | <-- 質問
         +------+-------+
                |
    +-----------+-----------+-----------+
    |           |           |           |
 RAG Agent  Code Agent  Analysis   Chitchat
    |           |        Agent      Agent
    +-----------+-----------+-----------+
                |
          +-----+-----+
          | Aggregator |  <-- マルチホップ応答の結合
          +-----+------+
                |
               END
```

### 4.1 Supervisor -- ルーター

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

Supervisor がレスポンスをエージェントシーケンスにパースする：

```python
agents = [a.strip() for a in result.split(",")]
valid = [a for a in agents if a in ("rag", "code", "analysis", "chitchat")]
```

### 4.2 マルチホップチェイニング

複雑なクエリは 2 つ以上のエージェントを順次通過できる。例えば「関連ドキュメントを見つけて、それに基づいてコードを書いて」は `["rag", "code"]` を生成する。各エージェントは前のエージェントのレスポンスをプロンプトで受け取る：

```python
def _format_previous(state: dict) -> str:
    responses = state.get("responses", {})
    if not responses:
        return "(none)"
    return "\n\n".join(f"[{a}]: {r[:500]}" for a, r in responses.items())
```

各エージェント後のルーティングロジック：

```python
def route_after_agent(state: dict) -> str:
    sequence = state.get("agent_sequence", [])
    hop = state.get("hop_count", 0) + 1
    if hop < len(sequence) and hop < state.get("max_hops", 3):
        return "next_hop"
    return "aggregator"
```

### 4.3 Aggregator

複数のエージェントが貢献した場合、Aggregator がレスポンスを結合する：

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

### 4.4 マルチエージェントグラフの構築

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

## 5. 本番環境：FastAPI エンドポイント

2 つのルーターで合計 11 エンドポイント：

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/langgraph/health` | パイプラインステータス + 機能フラグ |
| GET | `/langgraph/metrics` | 集約モニタリングダッシュボード |
| GET | `/langgraph/bandit` | RL バンディットアーム統計 |
| POST | `/langgraph/invoke` | フル RAG パイプライン（JSON） |
| POST | `/langgraph/chat` | NDJSON ストリーミング ノードごとのイベント |
| POST | `/langgraph/agent` | Supervisor ベースのマルチエージェント |
| POST | `/langgraph/evaluate` | バッチ RAGAS 評価 |
| POST | `/question` | レガシー抽出型 QA |
| GET | `/jobs/health` | 求人検索エージェント ヘルスチェック |
| POST | `/jobs/search` | 求人検索 RAG エージェント |
| POST | `/jobs/detail` | 求人詳細検索 |

ストリーミングエンドポイントはデバッグに特に有用だ -- 各グラフノードの完了時に NDJSON イベントを発行する：

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

## 6. モニタリングと可観測性

### ノードごとのレイテンシ

すべてのノードが `_timed()` で実行時間を記録する。`/metrics` エンドポイントが集約統計を返す：

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

### LangSmith トレーシング

`LANGCHAIN_TRACING_V2=true` と `LANGCHAIN_API_KEY` を設定すると完全な LangSmith トレーシングが有効になる。すべての LangGraph ノード、すべての LLM コール、すべての検索が LangSmith UI にスパンとして表示される。コード変更不要 -- LangChain が自動的に計装する。

---

## 7. RAGAS 評価

オンラインとオフラインの両方の評価を含む：

**オンライン** -- `/invoke` エンドポイントによる単一クエリ評価：

```python
def evaluate_single(self, question, answer, contexts):
    dataset = Dataset.from_list([{
        "question": question, "answer": answer, "contexts": contexts,
    }])
    result = ragas_evaluate(dataset, metrics=[faithfulness, answer_relevancy])
    return {k: round(v, 4) for k, v in result.items()}
```

**オフライン** -- Gold-standard 評価スクリプト：

```bash
# 1. サーバー起動
uvicorn main:app --port 8000

# 2. Golden set リプレイ
python scripts/run_golden_set.py \
    --golden-set scripts/golden_set.jsonl \
    --output runs/golden_result.jsonl \
    --token $JWT_TOKEN

# 3. RAGAS 評価実行
python scripts/eval_ragas.py \
    --input runs/golden_result.jsonl
```

出力：

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

評価スクリプトはカテゴリ別（事実型、手続き型、比較型）のスコアも分類し、弱点を容易に特定できる。

---

## 8. デプロイ

ヘルスチェック付き Docker デプロイ：

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

環境変数：

```bash
ANTHROPIC_API_KEY=sk-...        # または OPENAI_API_KEY
LANGCHAIN_TRACING_V2=true       # LangSmith（オプション）
LANGCHAIN_API_KEY=ls-...        # LangSmith キー
RAG_RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
RAG_EMBEDDING_CACHE_DIR=./cache/embeddings
```

---

## 9. 得られた教訓

**HyDE は過小評価されている。** ユーザーが「X はどう設定するの？」と聞いたがドキュメントには「X の設定には Y と Z の設定が必要です」と書いてある場合、直接の埋め込み検索ではマッチしない。仮想回答「X を設定するには設定ファイルで Y と Z を設定します」がそのギャップを埋める。

**クロスエンコーダーリランキングが最も ROI の高い改善だ。**「FAISS top-4」から「FAISS top-20 後にクロスエンコーダー top-4」に変更したところ、RAGAS 評価でコンテキストプレシジョンが約 23% 向上した。

**バンディットは速く収束する。** 約 50 クエリ後に Thompson Sampling バンディットはセマンティッククエリには FAISS を、キーワード重視のクエリには BM25 を安定的に選択するようになる。ハイブリッドアームは技術/自然言語が混在するドキュメントコレクションで勝つ。

**Self-RAG リトライはまれだが価値がある。** 約 8% のクエリだけがハルシネーションリトライループをトリガーする。しかしその 8% こそ LLM が回答を捏造していたであろうクエリ -- ユーザーの信頼を損なうまさにそれだ。

**ストリーミングノードイベントはデバッグに不可欠だ。** NDJSON エンドポイントが時間がどこに費やされているか正確に示す。遅い `rerank` ノード（初回リクエスト時のクロスエンコーダーロード）が即座に見える。

---

## 10. 今後の展望

- **バンディット状態の永続化** -- 現在は再起動で初期化される；Redis へのシリアライズを予定
- **非同期クロスエンコーダー** -- リランカーは同期的；`asyncio.to_thread()` でラップすればイベントループを解放できる
- **評価駆動プロンプトチューニング** -- RAGAS スコアを自動プロンプト最適化の目的関数として活用
- **エージェントツール使用** -- Code エージェントにサンドボックス化された Python REPL へのアクセス権限を付与

---

*完全なソースは ChatBout AI リポジトリにある。RAG パイプラインは
`api/langgraph_rag.py`（723 行）、マルチエージェントシステムは
`api/multi_agent.py`（407 行）、FastAPI ルーターは
`api/langgraph_controller.py`（229 行）にある。*
