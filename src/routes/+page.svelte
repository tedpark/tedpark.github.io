<script lang="ts">
	import { projects } from '$lib/data/projects';
	import { posts } from '$lib/data/posts';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SiteNav from '$lib/components/SiteNav.svelte';

	const englishPosts = posts.filter((post) => post.lang === 'en');
	const featured = englishPosts[0];
	const recent = englishPosts.slice(1, 6);
</script>

<div class="min-h-screen">

	<SiteNav />

	<!-- Hero -->
	<section class="max-w-5xl mx-auto px-6 pt-40 pb-20">

		<p class="text-[11px] font-mono text-muted-foreground tracking-[0.3em] uppercase mb-6">
			ML / Quant Engineer · Writing &amp; Code
		</p>

		<h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
			Deep dives, then<br />
			<span class="text-foreground/35">the code behind them.</span>
		</h1>

		<p class="text-foreground/60 text-lg leading-relaxed max-w-xl mb-10">
			Reinforcement learning, MLOps, and quantitative systems —
			with real code and benchmark numbers from a live trading system.
		</p>

		<!-- Stats strip -->
		<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-mono text-muted-foreground">
			<span>{englishPosts.length} English Posts</span>
			<span class="text-border/80">·</span>
			<span>{projects.length} Projects</span>
			<span class="text-border/80">·</span>
			<span>Live on IBKR</span>
			<span class="text-border/80">·</span>
			<span>OOS Sharpe 3.716</span>
		</div>
	</section>

	<!-- ═══ 01 — Featured Writing ═══ -->
	{#if featured}
		<section>
			<div class="max-w-5xl mx-auto px-6">
				<div class="flex items-center gap-4 py-7 border-t border-white/[0.1]">
					<span class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase whitespace-nowrap">
						01 — Featured Writing
					</span>
					<div class="h-px flex-1 bg-white/[0.06]"></div>
					<a
						href="/blog"
						class="text-[10px] font-mono text-muted-foreground/70 hover:text-foreground transition-colors tracking-[0.2em] uppercase whitespace-nowrap"
					>All posts ↗</a>
				</div>
			</div>

			<!-- Featured (latest) — hero card treatment -->
			<div class="max-w-5xl mx-auto px-6 pb-12">
				<a
					href={`/blog/${featured.slug}`}
					class="block group rounded-xl border border-white/[0.08] hover:border-white/[0.18] bg-gradient-to-br from-white/[0.02] to-transparent transition-all p-8 md:p-12"
				>
					<div class="flex items-center gap-3 mb-5">
						<span class="text-[10px] font-mono text-foreground/80 px-2 py-0.5 border border-foreground/30 rounded tracking-[0.15em] uppercase">
							Latest
						</span>
						<time
							class="text-[10px] font-mono text-muted-foreground/70 tracking-[0.15em] uppercase"
							datetime={featured.date}
						>
							{featured.date}
						</time>
						<span class="text-border/80">·</span>
						<span class="text-[10px] font-mono text-muted-foreground/70">
							{featured.readingTime} min read
						</span>
					</div>

					<h2
						class="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4 group-hover:text-foreground/85 transition-colors"
					>
						{featured.title}
					</h2>

					{#if featured.subtitle}
						<p class="text-foreground/55 text-lg leading-relaxed mb-5 max-w-3xl">
							{featured.subtitle}
						</p>
					{/if}

					<p class="text-foreground/45 text-sm leading-relaxed mb-6 max-w-3xl">
						{featured.summary}
					</p>

					<div class="flex flex-wrap gap-2 mb-6">
						{#each featured.tags as tag}
							<span
								class="text-[10px] font-mono text-muted-foreground/80 px-2 py-0.5 border border-border/60 rounded"
							>{tag}</span>
						{/each}
					</div>

					<span class="text-[11px] font-mono text-foreground/70 group-hover:text-foreground transition-colors tracking-[0.15em] uppercase">
						Read post →
					</span>
				</a>
			</div>

			<!-- Recent posts list -->
			{#if recent.length > 0}
				<div class="max-w-5xl mx-auto px-6 pb-24 md:pb-32">
					<p class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase mb-6">
						More posts
					</p>
					<ul class="divide-y divide-border/40">
						{#each recent as post}
							<li>
								<a
									href={`/blog/${post.slug}`}
									class="block py-6 group"
								>
									<div class="flex items-center gap-3 mb-2">
										<time
											class="text-[10px] font-mono text-muted-foreground/60 tracking-[0.15em] uppercase"
											datetime={post.date}
										>{post.date}</time>
										<span class="text-border/80">·</span>
										<span class="text-[10px] font-mono text-muted-foreground/60">
											{post.readingTime} min
										</span>
									</div>
									<h3
										class="text-xl sm:text-2xl font-semibold tracking-tight leading-snug mb-2 group-hover:text-foreground/80 transition-colors"
									>{post.title}</h3>
									{#if post.subtitle}
										<p class="text-foreground/55 text-sm leading-relaxed max-w-3xl">
											{post.subtitle}
										</p>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	{/if}

	<!-- ═══ 02 — Books ═══ -->
	<section>
		<div class="max-w-5xl mx-auto px-6">
			<div class="flex items-center gap-4 py-7 border-t border-white/[0.1]">
				<span class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase whitespace-nowrap">
					02 — Books
				</span>
				<div class="h-px flex-1 bg-white/[0.06]"></div>
				<a
					href="/books"
					class="text-[10px] font-mono text-muted-foreground/70 hover:text-foreground transition-colors tracking-[0.2em] uppercase whitespace-nowrap"
				>All books ↗</a>
			</div>
		</div>

		<div class="max-w-5xl mx-auto px-6 pb-24 md:pb-32">
			<div class="grid md:grid-cols-2 gap-4">
				<!-- Book 1: Tauri 2 -->
				<a href="/books" class="group block rounded-xl border border-white/[0.08] hover:border-red-500/30 bg-gradient-to-br from-red-500/5 via-transparent to-transparent transition-all p-7">
					<p class="text-[10px] font-mono text-red-400/80 tracking-[0.25em] uppercase mb-3">
						Tauri 2 · Rust · SvelteKit
					</p>
					<h3 class="text-xl font-bold tracking-tight leading-tight mb-2 group-hover:text-foreground/85 transition-colors">
						Vibe Coding Tauri 2
					</h3>
					<p class="text-foreground/45 text-sm leading-relaxed mb-5">
						A hands-on record of building 4 Tauri 2 desktop apps and 2 Rust TUI apps with an AI agent loop.
					</p>
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-mono text-muted-foreground/60">18 chapters · PDF</span>
						<span class="text-[11px] font-mono text-foreground/60 group-hover:text-foreground transition-colors">$17 →</span>
					</div>
				</a>

				<!-- Book 2: Quant -->
				<a href="/books" class="group block rounded-xl border border-white/[0.08] hover:border-blue-500/30 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent transition-all p-7">
					<p class="text-[10px] font-mono text-blue-400/80 tracking-[0.25em] uppercase mb-3">
						Python · HMM · SAC RL · IBKR
					</p>
					<h3 class="text-xl font-bold tracking-tight leading-tight mb-2 group-hover:text-foreground/85 transition-colors">
						Agentic Quant Trading with Python
					</h3>
					<p class="text-foreground/45 text-sm leading-relaxed mb-5">
						A production-style financial ML/RL systems book: HMM regimes, SAC / QR-DQN, CVaR risk control, and FastAPI serving.
					</p>
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-mono text-muted-foreground/60">27 chapters · PDF</span>
						<span class="text-[11px] font-mono text-foreground/60 group-hover:text-foreground transition-colors">$22 →</span>
					</div>
				</a>
			</div>
		</div>
	</section>

	<!-- ═══ 03 — Projects ═══ -->
	<div id="portfolio"></div>
	{#each projects as project, i}
		<section>
			<!-- Labeled divider -->
			<div class="max-w-5xl mx-auto px-6">
				<div class="flex items-center gap-4 py-7 border-t border-white/[0.1]">
					<span class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase whitespace-nowrap">
						{['03 — Live System', '04 — Side Project', '05 — Side Project'][i]}
					</span>
					<div class="h-px flex-1 bg-white/[0.06]"></div>
				</div>
			</div>
			<div class="max-w-5xl mx-auto px-6 pb-24 md:pb-32">
				<ProjectCard {project} index={i} />
			</div>
		</section>
	{/each}

	<!-- Footer -->
	<footer class="border-t border-border/50">
		<div class="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
			<span class="text-[11px] text-muted-foreground font-mono">© 2026</span>
			<div class="flex items-center gap-6">
				<a
					href="mailto:itstedpark@gmail.com"
					class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono"
				>itstedpark@gmail.com</a>
				<a
					href="https://github.com/tedpark"
					target="_blank"
					rel="noopener noreferrer"
					class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono"
				>github.com/tedpark</a>
			</div>
		</div>
	</footer>

</div>
