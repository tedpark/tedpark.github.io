export type Screenshot = {
	src: string;
	alt: string;
};

export type Metric = {
	label: string;
	value: string;
};

export type Project = {
	id: string;
	title: string;
	subtitle: string;
	description: string;
	reviewerSummary: string[];
	highlights: string[];
	tags: string[];
	screenshots: Screenshot[];
	github?: string;
	period: string;
	metrics: Metric[];
};

export const projects: Project[] = [
	{
		id: 'chatbout-ai',
		title: 'ChatBout AI',
		subtitle: 'LangGraph RAG + Multi-Agent System',
		period: '2024 – 2026',
		description:
			'A production-oriented RAG backend that turns documents into grounded answers through an 8-node LangGraph workflow. The graph classifies the request, rewrites queries, retrieves from hybrid search, reranks candidates, grades relevance, generates the answer, and runs a hallucination check before returning the response. A second LangGraph supervisor routes complex requests across specialized RAG, Code, Analysis, and Chitchat workers, then aggregates the result. The system is exposed through FastAPI endpoints with SSE streaming, Docker deployment, RAGAS evaluation, and LangSmith tracing.',
		reviewerSummary: [
			'RAG system: classify → query transform → retrieve → rerank → grade → generate → hallucination check.',
			'Search quality: FAISS/BM25 hybrid retrieval, HyDE, multi-query expansion, Cross-Encoder reranking, RAGAS metrics.',
			'Agent orchestration: LangGraph Supervisor + 4 workers, multi-hop chaining, FastAPI endpoints, Docker deployment.'
		],
		highlights: [
			'8-node LangGraph StateGraph with conditional routing and Self-RAG retry loops',
			'FAISS/BM25/Hybrid retrievers with CacheBackedEmbeddings, MMR, HyDE, and 3-way multi-query expansion',
			'Cross-Encoder reranking using ms-marco-MiniLM to reorder top-k retrieval candidates',
			'LangGraph Supervisor pattern with RAG, Code, Analysis, and Chitchat workers',
			'RAGAS evaluation: faithfulness, answer relevancy, context precision, context recall',
			'Gold-standard Precision/Recall@k regression checks and LangSmith tracing',
			'11 FastAPI endpoints including health, metrics, evaluate, bandit, invoke, and SSE chat paths',
			'Docker deployment with embedding cache volume and service-oriented API boundaries'
		],
		tags: [
			'Python', 'FastAPI', 'LangGraph', 'LangChain', 'Haystack', 'FAISS', 'BM25',
			'RAGAS', 'LangSmith', 'MongoDB', 'Docker', 'Claude', 'OpenAI'
		],
		metrics: [
			{ label: 'RAG Nodes', value: '8' },
			{ label: 'Agents', value: '4' },
			{ label: 'API Routes', value: '11' }
		],
		screenshots: []
	},
	{
		id: 'book-writer-agent',
		title: 'Book Writer Agent',
		subtitle: 'LangGraph/RAG Manuscript Editing Workflow',
		period: '2024 – 2026',
		description:
			'A manuscript editing agent built to turn English-first or translation-heavy drafts into natural Korean technical prose. The workflow uses LangGraph for staged writing and revision, ChromaDB for style retrieval, and SentenceTransformers for semantic search over reference books and blog samples. It preserves code blocks and headings, validates revised sections, detects length collapse or meta text leakage, and falls back to source text when revision quality fails. The pipeline was used on two technical books across Tauri 2 desktop app development and Python quant trading AI.',
		reviewerSummary: [
			'Agent workflow: outline → research → writer → editor → code review; RAG research → section edit → validation.',
			'Vector retrieval: ChromaDB + ko-sroberta style search with file-hash incremental indexing.',
			'Production guardrails: code/header masking, revised-block extraction, quality checks, fallback recovery.'
		],
		highlights: [
			'LangGraph workflow for draft generation, research, editing, and validation',
			'ChromaDB + jhgan/ko-sroberta-multitask for Korean technical style retrieval',
			'Topic retrieval and writing-style retrieval combined into prompt-time context',
			'9-step revision pipeline: literal translation removal, flow review, terminology unification, beginner explanation, polish',
			'Code block and heading masking to keep technical structure stable during LLM rewriting',
			'Fallback logic for missing code blocks, meta text, invalid revised tags, or severe length drop',
			'Applied to 18 chapters of a Tauri 2 app book and 27 chapters of a Python quant trading AI book'
		],
		tags: ['Python', 'LangGraph', 'ChromaDB', 'RAG', 'Claude', 'SentenceTransformers', 'Markdown'],
		metrics: [
			{ label: 'Books', value: '2' },
			{ label: 'Chapters', value: '45' },
			{ label: 'Pipeline', value: '9-step' }
		],
		screenshots: []
	},
	{
		id: 'stock-trading-ai',
		title: 'Stock Trading AI',
		subtitle: 'Statistical Arbitrage System · SAC RL · Live on IBKR',
		period: '2022 – Present',
		description:
			'An ML-driven stat-arb system, designed and operated solo — from alpha research through live execution on IBKR. The core problem with statistical arbitrage is regime dependency: cointegration that holds in mean-reverting conditions deteriorates in trending regimes, causing pair spreads to diverge without reversion. An HMM regime classifier detects the current market state in real time and routes signals to the appropriate strategy branch. A SAC RL agent handles position sizing — its entropy-maximizing objective scales exposure with predicted signal strength, automatically cutting risk when conviction is low. Entry and exit signals are generated by an XGBoost / LightGBM / CatBoost ensemble and a PyTorch TFT sequence model, trained on multi-timeframe features from FMP, FRED, yfinance, and Alpha Vantage. QuestDB stores 10 years of 5-minute bars for time-series queries, with DuckDB used for analytical feature work. Live orders execute on IBKR via ib-async.',
		reviewerSummary: [
			'Finance system: market-data ingestion, QuestDB 5-minute bars, feature store, signal generation, broker API, and execution loop.',
			'AI/RL: SAC/PPO/QR-DQN experiments, MLflow model management, FastAPI inference, CVaR sizing.',
			'Operating proof: 32 live IBKR pairs, real-time P&L monitoring, Dockerized service layers.'
		],
		highlights: [
			'OOS Sharpe 3.716 · Ann. Return +71.5% vs SPY benchmark +11.7%',
			'HMM regime classifier feeds a strategy router — different signal logic per regime state',
			'SAC RL agent drives position sizing — entropy-maximizing policy scales exposure with signal conviction, not fixed rules',
			'Ensemble (XGBoost + LightGBM + CatBoost) + PyTorch TFT generate entry/exit signals; Optuna hyperparam sweep per model',

			'Data pipeline: FMP + FRED + yfinance + Alpha Vantage → QuestDB 10 years of 5-minute bars + DuckDB feature work → model training & inference',
			'FastAPI service layer: MongoDB (Beanie ODM) for trade records, Redis for cache, DuckDB for analytical queries — each layer purpose-fit',
			'Live execution on IBKR — 32 active stat-arb pairs, real-time order management and P&L tracking via ib-async',
			'Rust TUI (Ratatui + Tokio) for terminal monitoring; Tauri 2 + SvelteKit desktop dashboard'
		],
		tags: [
			'Python', 'PyTorch', 'SAC RL', 'HMM', 'XGBoost', 'LightGBM', 'CatBoost',
			'TFT', 'Optuna', 'FastAPI', 'QuestDB', 'DuckDB', 'MongoDB', 'Redis',
			'FMP API', 'Docker', 'IBKR', 'Tauri 2', 'Rust', 'Ratatui', 'SvelteKit'
		],
		metrics: [
			{ label: 'OOS Sharpe', value: '3.716' },
			{ label: 'Ann. Return', value: '+71.5%' },
			{ label: 'IBKR Live Pairs', value: '32' }
		],
		screenshots: Array.from({ length: 11 }, (_, i) => ({
			src: `/screenshots/trading/trading-${String(i + 1).padStart(2, '0')}.png`,
			alt: `Stock Trading AI screenshot ${i + 1}`
		}))
	},
	{
		id: 'readbooks-ai',
		title: 'ReadBooks.ai',
		subtitle: 'LLM-powered PDF Translation Desktop App',
		period: '2023',
		description:
			'A Tauri 2 native desktop app for reading English technical books in your native language, paragraph by paragraph. The original approach attempted to fine-tune T5 and fairseq models directly on Korean–English pairs — this was abandoned when the Korean training corpus proved too thin, producing token-level noise instead of coherent output. The architecture was rebuilt around Claude Haiku via the Anthropic API, with the Rust backend handling all network I/O through reqwest, while pdfjs-dist on the SvelteKit frontend extracts and segments paragraph-level text blocks from PDF files. An SSE-streamed Ask AI panel lets users ask questions mid-read, injecting the current page text as context so answers are always relevant to what\'s on screen.',
		reviewerSummary: [
			'Native desktop app: Tauri 2 + Rust backend + SvelteKit frontend.',
			'LLM product flow: PDF parsing, paragraph segmentation, Claude API translation, Ask AI streaming.',
			'Engineering judgment: tried direct model training first, then switched to API when data quality was the bottleneck.'
		],
		highlights: [
			'pdfjs-dist parses PDF structure and extracts text at paragraph granularity',
			'Rust backend (reqwest + tokio) calls Claude Haiku API with async concurrency',
			'30+ language support — translation target is user-configurable at runtime',
			'SSE streaming delivers Ask AI responses token-by-token for low-latency feel',
			'Failure-driven pivot: T5/fairseq fine-tune failed → insufficient Korean data → Claude API',
			'Fully offline-capable except for API calls; no server, no account required beyond API key'
		],
		tags: ['Tauri 2', 'Rust', 'SvelteKit', 'TailwindCSS', 'Claude API', 'reqwest', 'tokio', 'pdfjs-dist'],
		metrics: [
			{ label: 'Languages', value: '30+' },
			{ label: 'LLM Backend', value: 'Claude' },
			{ label: 'Platform', value: 'Native' }
		],
		screenshots: Array.from({ length: 5 }, (_, i) => ({
			src: `/screenshots/readbooks/readbooks-${String(i + 1).padStart(2, '0')}.png`,
			alt: `ReadBooks.ai screenshot ${i + 1}`
		}))
	},
	{
		id: 'mandai',
		title: 'Mandai',
		subtitle: 'Goal Management Desktop App with Built-in AI Coach',
		period: '2024',
		description:
			'A Tauri 2 desktop app that replaces three separate productivity tools — Mandala Chart, GTD, and Pomodoro — with one coherent workflow. The Mandala Chart gives goals a spatial structure: each outer cell expands into its own 3×3 action plan, with a drill-down navigator that moves through hierarchy levels. GTD state management runs as an explicit state machine in Rust, tracking items across Inbox → Next Actions → Waiting → Done with enforced transitions. Pomodoro sessions drive the focus cycle and write session data to DuckDB through the Rust backend, keeping everything local-first with no cloud dependency. An Ask AI feature injects the current goal and its context into an OpenAI/Anthropic prompt and streams the coaching response back via SSE.',
		reviewerSummary: [
			'Local-first desktop system: Rust state machine, DuckDB storage, SvelteKit UI.',
			'AI feature: OpenAI/Anthropic prompt flow with current goal context and SSE streaming.',
			'Product design: combines Mandala Chart, GTD, and Pomodoro into one workflow.'
		],
		highlights: [
			'3-in-1 workflow: Mandala Chart spatial hierarchy + GTD state machine + Pomodoro timer',
			'Rust state machine enforces GTD transitions — no invalid state changes possible',
			'Drill-down navigation: click any cell to expand its own 3×3 Mandala sub-plan',
			'DuckDB via Rust backend — all data stays local, zero cloud dependency',
			'AI coach: OpenAI/Anthropic prompt flow with current goal context',
			'SSE-streamed Ask AI with goal context injection and GTD expert system prompt'
		],
		tags: ['Tauri 2', 'Rust', 'SvelteKit', 'TailwindCSS', 'DuckDB', 'OpenAI', 'Claude'],
		metrics: [
			{ label: 'LLM APIs', value: '2' },
			{ label: 'Methodology', value: '3-in-1' },
			{ label: 'Storage', value: 'Local-first' }
		],
		screenshots: Array.from({ length: 7 }, (_, i) => ({
			src: `/screenshots/mandai/mandai-${String(i + 1).padStart(2, '0')}.png`,
			alt: `Mandai screenshot ${i + 1}`
		}))
	}
];
