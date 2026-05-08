/** Map from tag label → official site (or GitHub if no official site) */
export const techLinks: Record<string, string> = {
	// Languages & runtimes
	Python:         'https://www.python.org/',
	Rust:           'https://www.rust-lang.org/',

	// ML / AI frameworks
	PyTorch:        'https://pytorch.org/',
	'SAC RL':       'https://github.com/haarnoja/sac',
	HMM:            'https://github.com/hmmlearn/hmmlearn',
	XGBoost:        'https://xgboost.readthedocs.io/',
	LightGBM:       'https://lightgbm.readthedocs.io/',
	CatBoost:       'https://catboost.ai/',
	TFT:            'https://github.com/jdb78/pytorch-forecasting',
	Optuna:         'https://optuna.org/',

	// Backend / API
	FastAPI:        'https://fastapi.tiangolo.com/',
	reqwest:        'https://docs.rs/reqwest/',
	tokio:          'https://tokio.rs/',

	// Data / DB
	DuckDB:         'https://duckdb.org/',
	QuestDB:        'https://questdb.io/',
	MongoDB:        'https://www.mongodb.com/',
	Redis:          'https://redis.io/',
	'FMP API':      'https://site.financialmodelingprep.com/',

	// Infrastructure
	Docker:         'https://www.docker.com/',

	// Brokers
	IBKR:           'https://www.interactivebrokers.com/',

	// Frontend / Native
	'Tauri 2':      'https://tauri.app/',
	SvelteKit:      'https://kit.svelte.dev/',
	TailwindCSS:    'https://tailwindcss.com/',
	Ratatui:        'https://ratatui.rs/',

	// AI providers
	'Claude API':   'https://docs.anthropic.com/',
	Claude:         'https://docs.anthropic.com/',
	OpenAI:         'https://platform.openai.com/',

	// PDF
	'pdfjs-dist':   'https://mozilla.github.io/pdf.js/',
};
