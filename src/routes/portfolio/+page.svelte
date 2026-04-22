<script lang="ts">
	import { projects } from '$lib/data/projects';
	import { posts } from '$lib/data/posts';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SiteNav from '$lib/components/SiteNav.svelte';

	const recentPosts = posts.slice(0, 3);
</script>

<div class="min-h-screen">

	<SiteNav label="Portfolio" />

	<!-- Hero -->
	<section class="max-w-5xl mx-auto px-6 pt-40 pb-20">

		<p class="text-[11px] font-mono text-muted-foreground tracking-[0.3em] uppercase mb-6">
			Quant Developer · AI Engineer
		</p>

		<h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
			Alpha Research<br />
			<span class="text-foreground/35">to Live Execution.</span>
		</h1>

		<p class="text-foreground/60 text-lg leading-relaxed max-w-xl mb-10">
			ML-powered stat-arb — HMM regime classification, SAC RL sizing, ensemble signals.<br />
			32 active pairs on IBKR · OOS Sharpe 3.716 · Built and operated solo.
		</p>

		<!-- Stats strip -->
		<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-mono text-muted-foreground">
			<span>3 Projects</span>
			<span class="text-border/80">·</span>
			<span>Live on IBKR</span>
			<span class="text-border/80">·</span>
			<span>OOS Sharpe 3.716</span>
			<span class="text-border/80">·</span>
			<span>HMM + SAC RL · Ensemble + TFT</span>
		</div>
	</section>

	<!-- ═══ Projects ═══ -->
	{#each projects as project, i}
		<section>
			<!-- Labeled divider -->
			<div class="max-w-5xl mx-auto px-6">
				<div class="flex items-center gap-4 py-7 border-t border-white/10">
					<span class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase whitespace-nowrap">
						{['01 — Live System', '02 — Side Project', '03 — Side Project'][i]}
					</span>
					<div class="h-px flex-1 bg-white/6"></div>
				</div>
			</div>
			<div class="max-w-5xl mx-auto px-6 pb-24 md:pb-32">
				<ProjectCard {project} index={i} />
			</div>
		</section>
	{/each}

	<!-- ═══ Recent Writing ═══ -->
	{#if recentPosts.length > 0}
		<section>
			<div class="max-w-5xl mx-auto px-6">
				<div class="flex items-center gap-4 py-7 border-t border-white/10">
					<span class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase whitespace-nowrap">
						04 — Writing
					</span>
					<div class="h-px flex-1 bg-white/6"></div>
					<a
						href="/blog"
						class="text-[10px] font-mono text-muted-foreground/70 hover:text-foreground transition-colors tracking-[0.2em] uppercase whitespace-nowrap"
					>All posts ↗</a>
				</div>
			</div>
			<div class="max-w-5xl mx-auto px-6 pb-24 md:pb-32">
				<ul class="divide-y divide-border/40">
					{#each recentPosts as post}
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
									<p class="text-foreground/55 text-sm leading-relaxed max-w-2xl">
										{post.subtitle}
									</p>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}

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
