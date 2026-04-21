<svelte:head>
	<title>Books — Ted Park</title>
	<meta name="description" content="Technical e-books by Ted Park. AI-assisted development — Tauri 2 desktop apps and Python quant trading systems. Korean · English · Japanese." />
	<meta property="og:title" content="Books — Ted Park" />
	<meta property="og:description" content="AI로 실제 제품을 혼자 만드는 방법. 기술 전자책 2종. 한국어 · English · 日本語." />

</svelte:head>

<script lang="ts">
	import SiteNav from '$lib/components/SiteNav.svelte';

	// ─── Language ────────────────────────────────────────────────────────────
	type Lang = 'ko' | 'en' | 'ja';
	const langs: Lang[] = ['ko', 'en', 'ja'];
	const langLabel: Record<Lang, string> = { ko: '한국어', en: 'English', ja: '日本語' };
	const langFlag: Record<Lang, string> = { ko: '🇰🇷', en: '🇺🇸', ja: '🇯🇵' };

	let activeLang = $state<Lang>('ko');

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
		subtitle: Record<Lang, string>;
		desc: Record<Lang, string>;
		chapters: number;
		gradient: string;
		borderHover: string;
		tagColor: string;
		price: Record<Lang, string>;
		lsKey: string;
		sample: string;
		highlights: string[];
	}

	const books: BookDef[] = [
		{
			id: 'tauri2',
			tag: 'Tauri 2 · Rust · SvelteKit · DuckDB',
			titleHtml: 'Vibe Coding<br />Tauri 2',
			subtitle: {
				ko: '시간이 없어서 오히려 6개를 만들었다',
				en: 'No Time — So I Built Six Apps Anyway',
				ja: '時間がなかったから、6つ作った'
			},
			desc: {
				ko: 'AI 에이전트와 반복 루프로 저녁 한두 시간만으로 Tauri 2 앱 4개 + TUI 앱 2개를 완성한 실전 기록. 요청 · 구현 · 검증 루프의 실제 작동 방식.',
				en: 'A hands-on record of building 4 Tauri 2 desktop apps + 2 TUI apps in evening sessions using an AI agent loop. How the request–implement–verify cycle actually works.',
				ja: 'AIエージェントのループを使い、夜の1〜2時間でTauri 2アプリ4本とTUIアプリ2本を完成させた実践記録。'
			},
			chapters: 18,
			gradient: 'from-red-500/10 via-transparent to-transparent',
			borderHover: 'hover:border-red-500/40',
			tagColor: 'text-red-400',
			price: { ko: '₩22,000', en: '$17', ja: '¥2,500' },
			lsKey: 'tauri2',
			sample: '/sample/tauri2-ko-sample.pdf',
			highlights: [
				'ReadBooks.ai — PDF 번역 데스크톱 앱 (Claude API + pdfjs)',
				'Mandai — Mandala Chart × GTD × Pomodoro 생산성 앱',
				'Rust TUI — Ratatui + Tokio 터미널 대시보드 2종',
				'Trading Monitor — IBKR 실시간 P&L Tauri 2 앱',
				'Rust 백엔드 SSE 스트리밍 패턴 완전 구현',
				'DuckDB 로컬 스토어 + Beanie ODM MongoDB 통합'
			]
		},
		{
			id: 'quant',
			tag: 'Python · HMM · SAC RL · IBKR · FastAPI',
			titleHtml: 'Stock Trading AI<br /><span style="opacity:0.4">실전 구현</span>',
			subtitle: {
				ko: '4년 솔로 빌드 — HMM · SAC RL · 통계적 차익거래',
				en: '4-Year Solo Build — HMM · SAC RL · Statistical Arbitrage',
				ja: '4年間のソロビルド — HMM · SAC RL · 統計的裁定取引'
			},
			desc: {
				ko: 'OOS Sharpe 3.716, IBKR 라이브 32 페어. HMM 레짐 분류기부터 SAC RL 포지션 사이징, FastAPI 서비스, Rust TUI 모니터링까지 — 실제 운영 중인 시스템의 전체 아키텍처.',
				en: 'OOS Sharpe 3.716, live on IBKR with 32 pairs. Complete architecture of a running system — HMM regime classifier, SAC RL position sizing, FastAPI service layer, Rust TUI monitoring.',
				ja: 'OOSシャープ比3.716、IBKR本番稼働中32ペア。HMMレジーム分類からSAC RLポジションサイジング、FastAPIサービス、Rust TUIモニタリングまで実際に動くシステムの全アーキテクチャ。'
			},
			chapters: 27,
			gradient: 'from-blue-500/10 via-transparent to-transparent',
			borderHover: 'hover:border-blue-500/40',
			tagColor: 'text-blue-400',
			price: { ko: '₩28,000', en: '$22', ja: '¥3,200' },
			lsKey: 'quant',
			sample: '/sample/quant-ko-sample.pdf',
			highlights: [
				'HMM 레짐 분류기 → 전략 라우터 구현',
				'SAC RL 에이전트 포지션 사이징 (엔트로피 최대화)',
				'XGBoost + LightGBM + CatBoost + TFT 앙상블',
				'DuckDB 피처 스토어 + Optuna 하이퍼파라미터 튜닝',
				'FastAPI + MongoDB (Beanie) + Redis 서비스 레이어',
				'IBKR ib-async 실시간 주문 실행 + Rust TUI 모니터링'
			]
		}
	];

	const steps = [
		{
			step: '01',
			title: 'Choose & Buy',
			desc: 'Lemon Squeezy 보안 결제. 카드 · PayPal · 21개 결제 수단. 전 세계 VAT 자동 처리.'
		},
		{
			step: '02',
			title: 'Instant Download',
			desc: '결제 즉시 PDF 다운로드 링크가 이메일로 전송됩니다.'
		},
		{
			step: '03',
			title: 'Lifetime Updates',
			desc: '책이 업데이트될 때마다 최신 버전 다운로드 링크 이메일 전달.'
		}
	];
</script>

<div class="min-h-screen">
	<SiteNav label="Books" />

	<!-- ═══ Hero ═══ -->
	<section class="max-w-5xl mx-auto px-6 pt-40 pb-20">
		<p class="text-[11px] font-mono text-muted-foreground tracking-[0.3em] uppercase mb-6">
			Technical E-Books · PDF · 한국어 · English · 日本語
		</p>

		<h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
			AI로 <span class="text-foreground">실제 제품</span>을<br />
			<span class="text-foreground/35">혼자 만드는 방법.</span>
		</h1>

		<p class="text-foreground/60 text-lg leading-relaxed max-w-xl mb-10">
			AI 에이전트와 함께 일하는 방식을 다루는 기술 전자책 2종.<br />
			실제로 만들고 실제로 운영 중인 시스템의 기록.
		</p>

		<!-- Language selector -->
		<div class="flex items-center gap-3 mb-8">
			<span class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.3em] uppercase">
				Language
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
			<span>Korean · English · Japanese</span>
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
						<span
							class="text-[10px] font-mono {book.tagColor} tracking-[0.25em] uppercase mb-3 block"
						>
							{book.tag}
						</span>
						<h2 class="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
							{@html book.titleHtml}
						</h2>
						<p class="text-xl text-foreground/60 mb-2">
							{book.subtitle[activeLang]}
						</p>
						<p class="text-foreground/45 text-sm leading-relaxed max-w-2xl mb-8">
							{book.desc[activeLang]}
						</p>

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
				<span>🍋</span>
				<span>
					Powered by Lemon Squeezy — secure checkout, automatic global tax compliance, instant
					delivery
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
						<h3 class="text-xl font-bold mb-3">Ted Park (박승환)</h3>
						<p class="text-foreground/55 text-sm leading-relaxed max-w-2xl">
							ML / Quant Engineer. 4년간 솔로로 통계적 차익거래 시스템을 설계·구현·운영 중 — HMM 레짐
							분류, SAC RL 포지션 사이징, FastAPI 서비스, IBKR 라이브 실행까지 전 스택 직접 담당. Tauri
							2 + Rust + SvelteKit으로 데스크톱 앱도 병행 제작. 이 책들은 그 과정의 실전 기록입니다.
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
