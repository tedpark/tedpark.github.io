<script lang="ts">
	import { projects } from '$lib/data/projects';
	import AgentWriting from '$lib/components/AgentWriting.svelte';
	import FeaturedBooks from '$lib/components/FeaturedBooks.svelte';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import SiteNav from '$lib/components/SiteNav.svelte';

	const reviewerPoints = [
 { label: 'Agent execution', value: 'Tool admission, bounded reasoning, context, cancellation, and recovery—with the validation scope stated per case.' },
 { label: 'End-to-end ownership', value: 'React interfaces, backend APIs, data models, authentication, and deployment around the AI workflow.' },
 { label: 'Applied AI', value: 'Document questions, manuscript revision, book publishing, and research data. Quant is one application of the work.' }
 ];
</script>

<svelte:head>
 <title>Portfolio — Ted Park · AI Agents &amp; Backend Systems</title>
 <meta name="description" content="Five independent engineering cases: Agent Hub, a Rust/Go/Elixir agent harness, Book Writer, Folio Books, and market-data systems. Ownership, design choices, and dated evidence." />
</svelte:head>
<div class="min-h-screen">

	<SiteNav label="Portfolio" />

	<!-- Hero -->
	<section class="max-w-5xl mx-auto px-6 pt-40 pb-20">

		<p class="text-[11px] font-mono text-muted-foreground tracking-[0.3em] uppercase mb-6">
			AI Agent &amp; Backend Engineer · Selected work
		</p>

		<h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
			From model output<br />
			<span class="text-foreground/35">to working products.</span>
		</h1>

		<p class="text-foreground/60 text-lg leading-relaxed max-w-xl mb-10">
			Five independent projects: the problem, my implementation, and the evidence behind it.
			These are separate from my employment. Source and historical verification records were reviewed on October 7, 2026.
		</p>

		<!-- Stats strip -->
		<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-mono text-muted-foreground">
			<span>{projects.length} Projects</span>
			<span class="text-border/80">·</span>
			<span>Agent execution</span>
			<span class="text-border/80">·</span>
			<span>FastAPI + Docker</span>
			<span class="text-border/80">·</span>
			<span>Source and scope per case</span>
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
					What to look for in these cases
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

 <section id="execution-models" class="max-w-5xl mx-auto px-6 pb-16 scroll-mt-20">
  <h2 class="text-2xl font-semibold mb-5">How the projects fit together</h2>
  <div class="space-y-4 text-sm leading-relaxed text-foreground/75">
   <p><strong class="text-foreground">Agent harness.</strong> QuantSigma connects Rust/Rig, Go/Eino, and Elixir/Jido reasoning engines to shared execution rules. Temporal manages durable workflow progress; PostgreSQL retains application history and effect records.</p>
   <p><strong class="text-foreground">AI workflows and integration.</strong> Agent Hub connects independently owned services and manages task admission and status. Book Writer uses its own LangGraph revision workflow, structural checks, and file checkpoints. These projects have separate execution models.</p>
   <p><strong class="text-foreground">Products and public examples.</strong> Folio Books handles publishing and reader access. The <a href="/demos/manuscript-guard" class="underline underline-offset-4">Book Writer demo</a> uses synthetic replies to demonstrate manuscript checks in the browser; it does not run a model or the full agent runtime.</p>
  </div>
 </section>
	<!-- ═══ Projects ═══ -->
	{#each projects as project, i}
		<section id={project.id} class="scroll-mt-20">
			<!-- Labeled divider -->
			<div class="max-w-5xl mx-auto px-6">
				<div class="flex items-center gap-4 py-7 border-t border-white/10">
					<span class="text-[10px] font-mono text-muted-foreground/50 tracking-[0.35em] uppercase whitespace-nowrap">
						{`${String(i + 1).padStart(2, '0')} — ${project.category}`}
					</span>
					<div class="h-px flex-1 bg-white/6"></div>
				</div>
			</div>
			<div class="max-w-5xl mx-auto px-6 pb-24 md:pb-32">
				<ProjectCard {project} index={i} />
			</div>
		</section>
	{/each}

	<AgentWriting />
	<FeaturedBooks />

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
