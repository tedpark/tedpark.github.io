<svelte:head>
	<title>Books — Ted Park</title>
	<meta name="description" content="Technical books by Ted Park on AI-assisted software engineering, Tauri 2 desktop apps, and production-style Python quant trading systems." />
	<meta property="og:title" content="Books — Ted Park" />
	<meta property="og:description" content="English-first technical books on building real software systems with AI agents, Tauri 2, Rust, Python, financial ML, and trading infrastructure." />

</svelte:head>

<script lang="ts">
	import SiteNav from '$lib/components/SiteNav.svelte';

	// ─── Language ────────────────────────────────────────────────────────────
	type Lang = 'ko' | 'en' | 'ja';
	const langs: Lang[] = ['en', 'ko', 'ja'];
	const langLabel: Record<Lang, string> = { ko: 'Korean edition', en: 'English edition', ja: 'Japanese edition' };
	const langFlag: Record<Lang, string> = { ko: '🇰🇷', en: '🇺🇸', ja: '🇯🇵' };

	let activeLang = $state<Lang>('en');

	// ─── Gumroad product checkout URLs ─────────────────────────────────────
	const LS: Record<string, Record<Lang, string>> = {
		tauri2: {
			ko: 'https://4273091654334.gumroad.com/l/tauri2-ko',
			en: 'https://4273091654334.gumroad.com/l/tauri2-en',
			ja: 'https://4273091654334.gumroad.com/l/tauri2-ja'
		},
		quant: {
			ko: 'https://4273091654334.gumroad.com/l/stock-trading-ai-ko',
			en: 'https://4273091654334.gumroad.com/l/stock-trading-ai-en',
			ja: 'https://4273091654334.gumroad.com/l/stock-trading-ai-ja'
		}
	};

	// ─── Book data ───────────────────────────────────────────────────────────
	interface BookDef {
		id: string;
		tag: string;
		titleHtml: string;
		subtitle: string;
		desc: string;
		chapters: number;
		gradient: string;
		borderHover: string;
		tagColor: string;
		price: Record<Lang, string>;
		lsKey: string;
		sample: string;
		cover: string;
		highlights: string[];
	}

	const books: BookDef[] = [
		{
			id: 'tauri2',
			tag: 'Tauri 2 · Rust · SvelteKit · DuckDB',
			titleHtml: 'Vibe Coding<br />Tauri 2',
			subtitle: 'No Time — So I Built Six Apps Anyway',
			desc: 'A hands-on record of building 4 Tauri 2 desktop apps and 2 Rust TUI apps in evening sessions using an AI agent loop. The book focuses on the request, implementation, verification, and iteration patterns that made the work practical.',
			chapters: 18,
			gradient: 'from-red-500/10 via-transparent to-transparent',
			borderHover: 'hover:border-red-500/40',
			tagColor: 'text-red-400',
			price: { ko: '₩22,000', en: '$17', ja: '¥2,500' },
			lsKey: 'tauri2',
			sample: '/sample/tauri2-en-sample.pdf',
			cover: '/covers/tauri2-en-cover.jpg',
			highlights: [
				'ReadBooks.ai — a Tauri 2 desktop app for PDF translation with Claude API and pdfjs',
				'Mandai — a Mandala Chart, GTD, and Pomodoro productivity app',
				'Rust TUI dashboards built with Ratatui and Tokio',
				'Trading Monitor — a Tauri 2 app for real-time IBKR P&L monitoring',
				'Rust backend patterns for command handling and SSE streaming',
				'DuckDB local storage and MongoDB integration patterns'
			]
		},
		{
			id: 'quant',
			tag: 'Python · HMM · SAC RL · IBKR · FastAPI',
			titleHtml: 'Agentic Quant<br /><span style="opacity:0.4">Trading with Python</span>',
			subtitle: 'HMM Regime Detection · SAC / QR-DQN · Statistical Arbitrage',
			desc: 'A production-style financial ML/RL systems book covering a running architecture: HMM regime classification, Kalman spread modeling, SAC and QR-DQN agents, CVaR-aware risk control, FastAPI serving, MLflow tracking, and Rust TUI monitoring.',
			chapters: 27,
			gradient: 'from-blue-500/10 via-transparent to-transparent',
			borderHover: 'hover:border-blue-500/40',
			tagColor: 'text-blue-400',
			price: { ko: '₩28,000', en: '$22', ja: '¥3,200' },
			lsKey: 'quant',
			sample: '/sample/quant-en-sample.pdf',
			cover: '/covers/quant-en-cover.jpg',
			highlights: [
				'HMM regime detection and strategy routing',
				'SAC reinforcement learning for position sizing',
				'QR-DQN quantiles, CVaR-style tail risk, and exposure control',
				'DuckDB feature store and Optuna hyperparameter search',
				'FastAPI, MongoDB / Beanie, Redis, and MLflow-style serving patterns',
				'IBKR integration concepts and Rust TUI monitoring architecture'
			]
		}
	];

	const steps = [
		{
			step: '01',
			title: 'Choose & Buy',
			desc: 'Choose the English, Korean, or Japanese edition and complete checkout through Gumroad.'
		},
		{
			step: '02',
			title: 'Instant Download',
			desc: 'The PDF download link is delivered immediately after purchase.'
		},
		{
			step: '03',
			title: 'Lifetime Updates',
			desc: 'When the book is updated, you can access the latest version from the same product page.'
		}
	];
</script>

<div class="min-h-screen">
	<SiteNav label="Books" />

	<!-- ═══ Hero ═══ -->
	<section class="max-w-5xl mx-auto px-6 pt-40 pb-20">
		<p class="text-[11px] font-mono text-muted-foreground tracking-[0.3em] uppercase mb-6">
			Technical Books · PDF · English First · Korean and Japanese Editions Available
		</p>

		<h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
			Technical books on<br />
			<span class="text-foreground">building real systems</span><br />
			<span class="text-foreground/35">with AI and code.</span>
		</h1>

		<p class="text-foreground/60 text-lg leading-relaxed max-w-xl mb-10">
			Two practical books from systems I actually built: Tauri 2 / Rust desktop apps
			and a production-style financial ML/RL trading system in Python.
		</p>

		<!-- Language selector -->
		<div class="flex items-center gap-3 mb-8">
			<span class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.3em] uppercase">
				Edition focus
			</span>
			<div class="flex gap-1">
				{#each langs as lang}
					<button
						class="text-[11px] font-mono px-3 py-1.5 rounded border transition-all {activeLang ===
						lang
							? 'bg-foreground text-background border-foreground'
							: 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'}"
						onclick={() => (activeLang = lang)}
					>
						{langFlag[lang]}
						{langLabel[lang]}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-mono text-muted-foreground">
			<span>2 Books</span>
			<span class="text-border/80">·</span>
			<span>English · Korean · Japanese</span>
			<span class="text-border/80">·</span>
			<span>PDF · Instant Download</span>
			<span class="text-border/80">·</span>
			<span>Lifetime Updates</span>
		</div>
	</section>

	<!-- ═══ Book Cards ═══ -->
	{#each books as book, i}
		<section>
			<!-- Labeled divider -->
			<div class="max-w-5xl mx-auto px-6">
				<div class="flex items-center gap-4 py-7 border-t border-white/[0.1]">
					<span
						class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase whitespace-nowrap"
					>
						{String(i + 1).padStart(2, '0')} — Book
					</span>
					<div class="h-px flex-1 bg-white/[0.06]"></div>
				</div>
			</div>

			<div class="max-w-5xl mx-auto px-6 pb-24 md:pb-32">
				<div
					class="rounded-xl border border-white/[0.08] {book.borderHover} transition-all overflow-hidden"
				>
					<!-- Book header -->
					<div class="bg-gradient-to-br {book.gradient} p-8 md:p-12 border-b border-white/[0.06]">
						<div class="grid gap-8 md:grid-cols-[1fr_13rem] md:items-start">
							<div>
								<span
									class="text-[10px] font-mono {book.tagColor} tracking-[0.25em] uppercase mb-3 block"
								>
									{book.tag}
								</span>
								<h2 class="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
									{@html book.titleHtml}
								</h2>
								<p class="text-xl text-foreground/60 mb-2">
									{book.subtitle}
								</p>
								<p class="text-foreground/45 text-sm leading-relaxed max-w-2xl mb-8">
									{book.desc}
								</p>
							</div>

							<img
								src={book.cover}
								alt={`${book.id} book cover`}
								class="w-full max-w-[13rem] rounded-lg border border-white/[0.12] bg-black/20 object-cover shadow-2xl shadow-black/30"
							/>
						</div>

						<!-- Stats -->
						<div
							class="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono text-muted-foreground/70 mb-8"
						>
							<span>{book.chapters} Chapters</span>
							<span class="text-border/80">·</span>
							<span>PDF · Instant Download</span>
							<span class="text-border/80">·</span>
							<span>Lifetime Updates Included</span>
						</div>

						<!-- Buy buttons — one per language -->
						<div class="flex flex-wrap gap-3">
							{#each langs as lang}
								<a
									href={LS[book.lsKey][lang]}
									class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all {activeLang ===
									lang
										? 'bg-foreground text-background hover:bg-foreground/90'
										: 'border border-border/60 text-muted-foreground hover:border-border hover:text-foreground'}"
								>
									{langFlag[lang]}
									<span class="font-mono">{book.price[lang]}</span>
									<span class="text-[10px] opacity-60">{langLabel[lang]}</span>
								</a>
							{/each}
							<a
								href={book.sample}
								download
								class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border border-border/40 text-muted-foreground/60 hover:text-muted-foreground hover:border-border/60 transition-all"
							>
								↓ Free Sample
							</a>
						</div>
					</div>

					<!-- Highlights -->
					<div class="p-8 md:p-12">
						<p
							class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase mb-6"
						>
							What's Inside
						</p>
						<ul class="grid sm:grid-cols-2 gap-x-8 gap-y-3">
							{#each book.highlights as h}
								<li class="flex items-start gap-3 text-sm text-foreground/60">
									<span class="text-foreground/30 font-mono mt-0.5 flex-shrink-0">→</span>
									{h}
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</div>
		</section>
	{/each}

	<!-- ═══ Purchase Flow ═══ -->
	<section>
		<div class="max-w-5xl mx-auto px-6">
			<div class="flex items-center gap-4 py-7 border-t border-white/[0.1]">
				<span
					class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase whitespace-nowrap"
				>
					03 — Purchase Flow
				</span>
				<div class="h-px flex-1 bg-white/[0.06]"></div>
			</div>
		</div>

		<div class="max-w-5xl mx-auto px-6 pb-24 md:pb-32">
			<div class="grid sm:grid-cols-3 gap-4">
				{#each steps as item}
					<div class="rounded-lg border border-white/[0.07] p-6">
						<span
							class="text-[10px] font-mono text-muted-foreground/40 tracking-[0.3em] uppercase block mb-3"
						>
							{item.step}
						</span>
						<h3 class="font-semibold mb-2">{item.title}</h3>
						<p class="text-sm text-foreground/50 leading-relaxed">{item.desc}</p>
					</div>
				{/each}
			</div>

			<div class="mt-8 flex items-center gap-3 text-[11px] font-mono text-muted-foreground/50">
				<span>↗</span>
				<span>
					Powered by Gumroad — secure checkout, instant PDF delivery, and hosted product updates
				</span>
			</div>
		</div>
	</section>

	<!-- ═══ Author ═══ -->
	<section>
		<div class="max-w-5xl mx-auto px-6">
			<div class="flex items-center gap-4 py-7 border-t border-white/[0.1]">
				<span
					class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase whitespace-nowrap"
				>
					04 — Author
				</span>
				<div class="h-px flex-1 bg-white/[0.06]"></div>
			</div>
		</div>

		<div class="max-w-5xl mx-auto px-6 pb-32">
			<div class="rounded-xl border border-white/[0.07] p-8 md:p-12">
				<div class="flex items-start gap-6">
					<div
						class="w-14 h-14 rounded-full bg-gradient-to-br from-foreground/20 to-foreground/5 border border-white/[0.1] flex items-center justify-center text-2xl flex-shrink-0"
					>
						👨‍💻
					</div>
					<div>
						<p
							class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.3em] uppercase mb-2"
						>
							Author
						</p>
						<h3 class="text-xl font-bold mb-3">Ted Park</h3>
						<p class="text-foreground/55 text-sm leading-relaxed max-w-2xl">
							Senior software engineer focused on production ML systems, financial time-series
							engineering, and AI-assisted software development. I build the systems behind these
							books myself: Tauri 2 / Rust desktop apps, Python trading infrastructure, HMM regime
							detection, RL experiments, FastAPI model serving, and public technical writing around
							what actually works.
						</p>
						<div
							class="flex flex-wrap gap-6 mt-5 text-[11px] font-mono text-muted-foreground/60"
						>
							<a href="/" class="hover:text-foreground transition-colors">Portfolio ↗</a>
							<a href="/blog" class="hover:text-foreground transition-colors">Blog ↗</a>
							<a
								href="https://github.com/tedpark"
								target="_blank"
								rel="noopener noreferrer"
								class="hover:text-foreground transition-colors"
							>
								github.com/tedpark ↗
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="border-t border-border/50">
		<div class="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
			<span class="text-[11px] text-muted-foreground font-mono">© 2026 Ted Park</span>
			<div class="flex items-center gap-6">
				<a
					href="mailto:itstedpark@gmail.com"
					class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono"
				>
					itstedpark@gmail.com
				</a>
				<a
					href="https://github.com/tedpark"
					target="_blank"
					rel="noopener noreferrer"
					class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono"
				>
					github.com/tedpark
				</a>
			</div>
		</div>
	</footer>
</div>
