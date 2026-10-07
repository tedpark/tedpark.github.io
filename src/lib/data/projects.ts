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
	category: string;
	evidence: string;
	links: { label: string; href: string }[];
};

export const projects: Project[] = [
  {
    "id": "agent-hub",
    "title": "Agent Hub",
    "subtitle": "Document Q&A, research jobs, and review workflows in one console",
    "period": "2026 · Independent project",
    "category": "Agent platform",
    "description": "I built the React and FastAPI console, authentication, tool integration, and deployment for a platform that connects document questions, CSV backtests, and product-document checks. A shared admission and status layer keeps the UI independent of each service’s execution model. LangGraph handles the reasoning flow; the application checks who can run a task and what tools it can use.",
    "reviewerSummary": [
      "Ownership: frontend, APIs, authentication, tool connections, and personal-server deployment.",
      "Decision: separate model/tool selection, request admission, and the service that executes a job.",
      "User result: follow a task from its accepted ID to status, cited output, or cancellation."
    ],
    "highlights": [
      "MCP, A2A, and REST connections through the open-source Agentgateway; I implemented the Hub integration.",
      "Matching owner, request key, and input hash reuse an accepted response. Reusing a key with different input returns HTTP 409.",
      "An uncertain external admission blocks automatic resubmission. Cancellation checks worker termination and suppresses late results.",
      "Document/version-scoped retrieval and citation matching; no model call when retrieval returns no evidence."
    ],
    "tags": [
      "React",
      "Python",
      "FastAPI",
      "LangGraph",
      "MCP",
      "A2A",
      "Docker"
    ],
    "metrics": [
      {
        "label": "Console",
        "value": "React"
      },
      {
        "label": "API",
        "value": "FastAPI"
      },
      {
        "label": "Connections",
        "value": "MCP / A2A"
      }
    ],
    "screenshots": [],
    "evidence": "Source and retained checks: September 2026. Worker cancellation was checked in an isolated deployment; retrieval comparisons used a small fixed query set. These do not establish customer-scale operation, general answer accuracy, or crash-safe concurrent resume.",
    "links": [
      {
        "label": "Project overview on LinkedIn",
        "href": "https://www.linkedin.com/feed/update/urn:li:activity:7513399139078963201/"
      }
    ]
  },
  {
    "id": "quantsigma-agent",
    "title": "QuantSigma Agent Harness",
    "subtitle": "Rust / Rig, Go / Eino, Elixir / Jido with a shared execution boundary",
    "period": "2026 · Independent project in development",
    "category": "Agent runtime",
    "description": "I treat an agent as a state machine with a goal, observations, pending calls, and an execution budget. Native reasoning engines consume retained request/reply pairs and yield the next external operation. The shared Go harness validates and records that operation. Temporal coordinates workflow lifetime, while PostgreSQL retains history, leases, and effect receipts.",
    "reviewerSummary": [
      "Ownership: reasoning adapters, context and execution contracts, and recovery behavior.",
      "Decision: keep each framework’s reasoning model while sharing permission and effect-recording rules.",
      "Application: read-only investigation of service state, market data, and stored observations, with provenance and unresolved questions."
    ],
    "highlights": [
      "October 7 architecture: native Rust Temporal SDK for Rust workflows; Go Temporal SDK for Go/Jido workflows.",
      "Exact request matching reuses retained replies; replay itself does not perform model or source HTTP calls.",
      "An unknown external outcome requires explicit recovery with the same request identity. Leases fence late commits; they cannot retract remote work.",
      "Sessions are pinned to engine/runtime versions. The retained archive and bounded model context serve different purposes."
    ],
    "tags": [
      "Rust",
      "Rig",
      "Go",
      "Eino",
      "Elixir",
      "Jido",
      "Temporal",
      "PostgreSQL"
    ],
    "metrics": [
      {
        "label": "Reasoning engines",
        "value": "3"
      },
      {
        "label": "Execution policy",
        "value": "Shared"
      },
      {
        "label": "Tool scope",
        "value": "Read-only"
      }
    ],
    "screenshots": [],
    "evidence": "Source review: October 7, 2026, native shared-harness design and recorded validation. This supersedes the October 5 Python-Activity bridge description for new native sessions; historical workers remain version-pinned. Deployment checks were not rerun for this page. No trading returns or exactly-once external effects are claimed.",
    "links": [
      {
        "label": "Go: execution boundaries",
        "href": "https://itstedpark.medium.com/a-go-agent-harness-separating-reasoning-from-effects-ceebb4d466fd"
      },
      {
        "label": "Rust: replay and typed IDs",
        "href": "https://itstedpark.medium.com/a-rust-agent-harness-replay-before-external-i-o-c4e20ee67b9a"
      }
    ]
  },
  {
    "id": "book-writer-agent",
    "title": "Book Writer",
    "subtitle": "AI-assisted technical manuscript translation and revision",
    "period": "May–August 2026 · Development and revision",
    "category": "Applied AI workflow",
    "description": "I built a workflow for translating English drafts into Korean technical prose and revising terminology, style, and logical flow. Topic and writing-style examples are retrieved separately. LangGraph stages the revision work, and structural checks protect the manuscript before I review the technical content. I applied it to two of my own technical books.",
    "reviewerSummary": [
      "Ownership: translation, retrieval, staged revision, structural checks, and restart records.",
      "Decision: retain the source section when code markers disappear or the generated output fails structural checks.",
      "Application: manuscript preparation for the Tauri 2 and Python trading-system books."
    ],
    "highlights": [
      "ChromaDB and ko-sroberta embeddings with source/page metadata and file-hash incremental indexing.",
      "Code blocks are masked; missing markers, lost headings, severe shortening, and editorial meta-text are checked.",
      "File checkpoints and translation progress records allow interrupted work to resume.",
      "Human review checks meaning and technical accuracy after structural validation. Folio handles publishing separately."
    ],
    "tags": [
      "Python",
      "LangGraph",
      "ChromaDB",
      "RAG",
      "Claude",
      "SentenceTransformers"
    ],
    "metrics": [
      {
        "label": "Applied to",
        "value": "2 books"
      },
      {
        "label": "Search",
        "value": "Topic + style"
      },
      {
        "label": "Review",
        "value": "Author-led"
      }
    ],
    "screenshots": [],
    "evidence": "Development records: May 4–August 21, 2026; manuscript application documented in the September portfolio review. This period is not continuous server uptime. No measured translation-quality uplift or time-saved percentage is claimed.",
    "links": [
      {
        "label": "Read the Tauri book",
        "href": "https://wikidocs.net/book/21320"
      },
      {
        "label": "Read the Python book",
        "href": "https://wikidocs.net/book/21322"
      }
    ]
  },
  {
    "id": "folio-books",
    "title": "Folio Books",
    "subtitle": "A publishing and reading platform for technical books",
    "period": "2026 · Independent service",
    "category": "Product engineering",
    "description": "I built the author studio, reader interface, data model, APIs, authentication, purchase verification, and edit-conflict handling. The product carries a manuscript from authoring to publication and gives readers access to public chapters and entitled content. It also hosts my writing about developer hiring.",
    "reviewerSummary": [
      "Ownership: React UI, Python Robyn backend, PostgreSQL model, and access control.",
      "Decision: recheck purchase state at content access; a provider outage can temporarily deny an entitled reader.",
      "User result: separate author editing, publication, and reader access in one product."
    ],
    "highlights": [
      "Session and resource-ownership checks guard author operations and content access.",
      "Revision-conditional updates detect concurrent edit conflicts rather than silently overwriting changes.",
      "Dedicated PostgreSQL integration tests covered access restrictions, session invalidation after password reset, and edit conflicts.",
      "Three Korean books connect the product to my own development, validation, and hiring experience."
    ],
    "tags": [
      "React",
      "Python",
      "Robyn",
      "PostgreSQL",
      "TypeScript"
    ],
    "metrics": [
      {
        "label": "Author books",
        "value": "3"
      },
      {
        "label": "Data",
        "value": "PostgreSQL"
      },
      {
        "label": "Editing",
        "value": "Revision checks"
      }
    ],
    "screenshots": [],
    "evidence": "Implementation and PostgreSQL integration-test records: September 28, 2026. Book links reviewed October 7. These demonstrate implemented flows, not paid-customer counts or revenue.",
    "links": [
      {
        "label": "Open Folio Books",
        "href": "https://books.quantsigma.ai/"
      },
      {
        "label": "Developer hiring book",
        "href": "https://wikidocs.net/book/21402"
      }
    ]
  },
  {
    "id": "stock-trading-ai",
    "title": "Stock Trading AI",
    "subtitle": "Market-data pipelines and explicit order-state handling",
    "period": "2022–present · Independent project",
    "category": "Data and execution systems",
    "description": "I built data collection, storage, analytical jobs, and order-management backends for a personal market-research system. The current portfolio focuses on preserving source evidence and handling uncertain execution states. QuestDB and a separate PostgreSQL/TimescaleDB path serve different storage workflows; I do not add their row counts together.",
    "reviewerSummary": [
      "Ownership: ingestion and storage checks, analytical jobs, order-state handling, and Python/Rust integration.",
      "Decision: preserve raw responses and flag suspect rows instead of deleting evidence during cleaning.",
      "Recovery: reconcile stored execution observations before repeating an uncertain order-related action."
    ],
    "highlights": [
      "Raw payloads, hashes, and collection history support comparison before and after UPSERT; clean views exclude flagged rows.",
      "Temporal handles retries, timeouts, and progress for selected jobs. A separate order controller owns fill-state handling.",
      "Rust Axum/Tokio gateway and PyO3/gel-tokio integration connect Python execution logic and a Rust data layer.",
      "ML/RL experiments and model-serving work are research components; their presence alone does not establish investment performance."
    ],
    "tags": [
      "Python",
      "Rust",
      "Temporal",
      "PostgreSQL",
      "TimescaleDB",
      "QuestDB",
      "PyTorch"
    ],
    "metrics": [
      {
        "label": "5-minute bars snapshot",
        "value": "~285M rows"
      },
      {
        "label": "Snapshot date",
        "value": "2026-09-30"
      },
      {
        "label": "Focus",
        "value": "Data integrity"
      }
    ],
    "screenshots": [],
    "evidence": "The September 30, 2026 read-only TimescaleDB query recorded about 285 million rows and 10.36 GiB for fmp_bars_5m, with table timestamps spanning September 2021–September 2026. This is a historical table snapshot, not complete coverage per instrument, current uptime, independently reconciled fills, or a return benchmark. No database or live-trading checks were rerun for this page.",
    "links": [
      {
        "label": "Public financial ML companion repository",
        "href": "https://github.com/tedpark/agentic-quant-trading-python"
      }
    ]
  }
];
