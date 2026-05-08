import {
	siPython,
	siPytorch,
	siRust,
	siSvelte,
	siTailwindcss,
	siDocker,
	siMongodb,
	siRedis,
	siFastapi,
	siAnthropic,
	siTauri,
	siDuckdb,
	siOptuna,
	siRatatui
} from 'simple-icons';

/** Map from tag label → SVG path (24×24 viewBox) */
export const techIconPaths: Record<string, string> = {
	Python:       siPython.path,
	PyTorch:      siPytorch.path,
	Rust:         siRust.path,
	SvelteKit:    siSvelte.path,
	TailwindCSS:  siTailwindcss.path,
	Docker:       siDocker.path,
	MongoDB:      siMongodb.path,
	Redis:        siRedis.path,
	FastAPI:      siFastapi.path,
	Claude:       siAnthropic.path,
	Anthropic:    siAnthropic.path,
	'Tauri 2':    siTauri.path,
	DuckDB:       siDuckdb.path,
	Optuna:       siOptuna.path,
	Ratatui:      siRatatui.path,
};
