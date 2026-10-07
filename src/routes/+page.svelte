<script lang="ts">
 import SiteNav from '$lib/components/SiteNav.svelte';
 import FeaturedBooks from '$lib/components/FeaturedBooks.svelte';
 import AgentWriting from '$lib/components/AgentWriting.svelte';
 import { projects } from '$lib/data/projects';
</script>
<svelte:head>
 <title>Ted Park — AI Agents &amp; Backend Systems</title>
 <meta name="description" content="Ted Park builds AI agents, backend systems, and tools for research, writing, and publishing. Explore current independent projects, engineering notes, and three Korean books." />
</svelte:head>
<SiteNav />
<main>
 <section class="max-w-5xl mx-auto px-6 pt-32 sm:pt-40 pb-16">
  <p class="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-6">Senior Software Engineer · AI Agents &amp; Backend Systems</p>
  <h1 class="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-7">AI systems,<br /><span class="text-foreground/60">built to do useful work.</span></h1>
  <p class="text-lg text-foreground/75 leading-relaxed max-w-2xl">I bring 15+ years of web, mobile, and service development to AI agents, retrieval, and workflow automation. I build the interfaces, execution rules, and recovery paths around the model—and write about the decisions behind them.</p>
  <div class="flex flex-wrap gap-4 mt-8 text-sm">
   <a href="/portfolio" class="rounded-lg bg-foreground text-background px-5 py-3 font-medium">Explore selected work →</a>
   <a href="https://www.linkedin.com/in/tedpark-financial-ml/" class="rounded-lg border border-border px-5 py-3">Career profile ↗</a>
   <a href="https://books.quantsigma.ai/" class="rounded-lg border border-border px-5 py-3">Read my books ↗</a>
  </div>
  <p class="text-xs text-muted-foreground mt-7">Updated October 7, 2026 · Independent projects are described separately from employment.</p>
 </section>
 <section class="max-w-5xl mx-auto px-6 py-12 border-t border-border">
  <h2 class="text-3xl font-semibold mb-7">Product experience behind the AI work</h2>
  <div class="grid md:grid-cols-3 gap-6 text-sm leading-relaxed text-foreground/75">
   <p><strong class="text-foreground">Product and team delivery.</strong> Led frontend development at CJ Oliveyoung as the team grew from one to four engineers; introduced Next.js and development, review, and deployment practices.</p>
   <p><strong class="text-foreground">Services from interface to backend.</strong> Built mobile trading interfaces and developed, shipped, and operated web, mobile, and real-time services as a startup co-founder and CTO.</p>
   <p><strong class="text-foreground">Applied AI and technical writing.</strong> Now a senior developer on Clush’s Agent Development Team. The work below is independent; it includes tools used in preparing my own technical books.</p>
  </div>
 </section>
 <section class="max-w-5xl mx-auto px-6 py-16 border-t border-border">
  <h2 class="text-3xl font-semibold mb-7">Selected independent projects</h2>
  <div class="grid md:grid-cols-2 gap-4">
   {#each projects as project}
    <a href={`/portfolio#${project.id}`} class="rounded-xl border border-border bg-card p-6 hover:border-foreground/40 transition-colors">
     <p class="text-xs text-muted-foreground mb-3">{project.category}</p>
     <h3 class="text-xl font-semibold mb-3">{project.title}</h3>
     <p class="text-sm text-foreground/75 leading-relaxed">{project.subtitle}</p>
    </a>
   {/each}
  </div>
 </section>
 <AgentWriting />
 <FeaturedBooks />
</main>
<footer class="max-w-5xl mx-auto px-6 py-10 border-t border-border flex flex-wrap gap-6 text-sm text-muted-foreground"><span>© 2026 Ted Park</span><a href="mailto:itstedpark@gmail.com">itstedpark@gmail.com</a><a href="https://github.com/tedpark">GitHub ↗</a></footer>
