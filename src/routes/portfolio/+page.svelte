<script lang="ts">
	import { projects } from '$lib/data/projects';
	import { posts } from '$lib/data/posts';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SiteNav from '$lib/components/SiteNav.svelte';

	const recentPosts = posts.filter((post) => post.lang === 'en').slice(0, 3);
	const reviewerPoints = [
		{
			label: 'RAG / Agent Systems',
			value: 'LangGraph 8-node RAG, FAISS/BM25 hybrid retrieval, Cross-Encoder reranking, RAGAS evaluation, and Supervisor-style multi-agent workflows.'
		},
		{
			label: 'AI Backend / Serving',
			value: 'Python/FastAPI APIs, SSE streaming, Docker deployment, model hot reload, MLflow registry, and production-oriented observability.'
		},
		{
			label: 'Applied Product Work',
			value: 'Turns LLM output into tested features: RAG chat, manuscript editing agents, PDF translation, AI coaching, and trading inference services.'
		}
	];
</script>

<div class="min-h-screen">

	<SiteNav label="Portfolio" />

	<!-- Hero -->
	<section class="max-w-5xl mx-auto px-6 pt-40 pb-20">

		<p class="text-[11px] font-mono text-muted-foreground tracking-[0.3em] uppercase mb-6">
			AI Engineer · RAG / Agent Systems
		</p>

		<h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
			RAG Agents<br />
			<span class="text-foreground/35">to Production AI.</span>
		</h1>

		<p class="text-foreground/60 text-lg leading-relaxed max-w-xl mb-10">
			LangGraph RAG, multi-agent orchestration, FastAPI model serving,<br />
			and data pipelines built into working products.
		</p>

		<!-- Stats strip -->
		<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-mono text-muted-foreground">
			<span>{projects.length} Projects</span>
			<span class="text-border/80">·</span>
			<span>LangGraph RAG</span>
			<span class="text-border/80">·</span>
			<span>FastAPI + Docker</span>
			<span class="text-border/80">·</span>
			<span>Model Serving + Data Pipelines</span>
		</div>
	</section>

	<!-- Recruiter summary -->
	<section class="max-w-5xl mx-auto px-6 pb-16">
		<div class="border-y border-white/10 py-8">
			<div class="flex flex-col gap-2 mb-7">
				<p class="text-[11px] font-mono text-muted-foreground tracking-[0.28em] uppercase">
					For resume reviewers
				</p>
				<h2 class="text-2xl md:text-3xl font-semibold tracking-tight">
					What this portfolio proves at a glance
				</h2>
			</div>
			<div class="grid md:grid-cols-3 gap-3">
				{#each reviewerPoints as point}
					<div class="rounded-md border border-white/10 bg-white/[0.035] p-4">
						<p class="text-[11px] font-mono uppercase tracking-[0.16em] text-foreground/45 mb-3">
							{point.label}
						</p>
						<p class="text-sm leading-relaxed text-foreground/75">
							{point.value}
						</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ═══ Projects ═══ -->
	{#each projects as project, i}
		<section id={project.id} class="scroll-mt-20">
			<!-- Labeled divider -->
			<div class="max-w-5xl mx-auto px-6">
				<div class="flex items-center gap-4 py-7 border-t border-white/10">
					<span class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase whitespace-nowrap">
						{['01 — RAG System', '02 — Agent Workflow', '03 — Model Serving', '04 — LLM App', '05 — AI App'][i] ?? `${String(i + 1).padStart(2, '0')} — Project`}
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
