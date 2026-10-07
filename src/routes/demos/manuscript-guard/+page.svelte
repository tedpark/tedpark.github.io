<script lang="ts">
 import SiteNav from '$lib/components/SiteNav.svelte';
 import { original, protect, review, scenarios } from '$lib/demo/guard.mjs';
 let selected = $state('missing');
 let candidate = $state(scenarios[1].candidate);
 let result = $derived(review(original, candidate));
 let lesson = $derived(scenarios.find(s => s.id === selected)?.lesson ?? 'Custom edit: inspect each check, then review the meaning yourself.');
 function choose(id: string) {
  selected = id;
  candidate = scenarios.find(s => s.id === id)!.candidate;
 }
</script>
<svelte:head>
 <title>Book Writer demo — Protect the manuscript · Ted Park</title>
 <meta name="description" content="Try six manuscript revision cases: lost code, missing headings, truncated replies, and a semantic error that passes structural checks. Local, synthetic, no model call." />
</svelte:head>
<SiteNav />
<main class="max-w-5xl mx-auto px-6 pt-28 pb-20">
 <a href="/portfolio#book-writer-agent" class="text-sm text-muted-foreground underline">← Book Writer case study</a>
 <p class="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-10 mb-4">Interactive engineering example · October 7, 2026</p>
 <h1 class="text-4xl sm:text-5xl font-semibold tracking-tight">Protect the manuscript.</h1>
 <p class="text-lg text-foreground/75 leading-relaxed max-w-3xl mt-5">An AI revision can read smoothly while losing a code example. Try the failure cases below and see when the original section is retained.</p>
 <p class="text-sm text-muted-foreground mt-4 max-w-3xl">A standalone teaching adaptation of Book Writer’s guard-and-fallback approach. The text and candidate replies are synthetic. All checks run in your browser, with no model call or manuscript upload.</p>
 <section class="mt-10" aria-labelledby="try-heading">
  <h2 id="try-heading" class="text-xl font-semibold">1. Choose a candidate reply</h2>
  <div class="flex flex-wrap gap-2 mt-4">
   {#each scenarios as scenario}<button type="button" aria-pressed={selected === scenario.id} class="rounded-lg border px-4 py-2 text-sm {selected === scenario.id ? 'bg-foreground text-background border-foreground' : 'border-border hover:border-foreground/60'}" onclick={() => choose(scenario.id)}>{scenario.label}</button>{/each}
  </div>
  <p class="mt-4 text-sm text-foreground/75 min-h-10">{lesson}</p>
  <div class="grid md:grid-cols-2 gap-5 mt-4">
   <div><label for="original" class="block text-sm mb-2">Protected source sent for revision</label><textarea id="original" readonly value={protect(original).masked} class="w-full h-72 rounded-xl border border-border bg-card p-4 text-sm font-mono leading-relaxed resize-y"></textarea></div>
   <div><label for="candidate" class="block text-sm mb-2">Candidate reply — editable</label><textarea id="candidate" bind:value={candidate} oninput={() => selected = 'custom'} class="w-full h-72 rounded-xl border border-border bg-card p-4 text-sm font-mono leading-relaxed resize-y" spellcheck="false"></textarea></div>
  </div>
 </section>
 <section class="rounded-xl border border-border bg-card p-6 mt-6" aria-labelledby="decision-heading">
  <h2 id="decision-heading" class="text-xl font-semibold">2. Inspect the decision</h2>
  <p role="status" aria-live="polite" class="text-lg mt-3 font-medium {result.accepted ? 'text-emerald-300' : 'text-amber-300'}">{result.accepted ? 'Ready for author review — structure checks passed' : 'Original retained — candidate rejected'}</p>
  <ul class="mt-4 space-y-2 text-sm">{#each result.checks as check}<li>{check.passed ? '✓' : '✕'} {check.name}</li>{/each}</ul>
  <details class="mt-5"><summary class="cursor-pointer text-sm underline">Inspect resulting manuscript</summary><pre class="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{result.output}</pre></details>
 </section>
 <section class="mt-10 grid md:grid-cols-2 gap-8 text-sm leading-relaxed text-foreground/75">
  <div><h2 class="text-xl font-semibold text-foreground mb-3">3. Reproduce the checks</h2><p>Download both files into one folder, then run the command with Node.js 20 or later. Eight tests cover the presets, unknown/reordered markers, original fallback, and unchanged code restoration.</p><div class="flex flex-wrap gap-4 my-4"><a class="underline" href="/demos/manuscript-guard/guard.mjs" download>Download guard.mjs</a><a class="underline" href="/demos/manuscript-guard/guard.test.mjs" download>Download guard.test.mjs</a></div><pre class="bg-card border border-border rounded-lg p-4 overflow-x-auto">node --test guard.test.mjs</pre><p class="mt-3"><a class="underline" href="https://github.com/tedpark/tedpark.github.io/tree/main/static/demos/manuscript-guard">Browse public example source ↗</a></p></div>
  <div><h2 class="text-xl font-semibold text-foreground mb-3">What this demonstrates</h2><p>Book Writer’s reviewed Python implementation masks code, retains a section when code markers disappear, and applies heading and length checks in its revision helpers. Different stages use different length thresholds.</p><p class="mt-3">This smaller JavaScript example combines checks into one rule, uses a 50% masked-length threshold, and additionally rejects duplicated or reordered markers. It is not a port of every runtime path or a full Markdown parser.</p><p class="mt-3">Passing structure checks does not establish factual accuracy, translation quality, safe code, or measured time savings. Select “Meaning changed” to see why author review remains necessary.</p></div>
 </section>
 <p class="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">My independent work: revision workflow, retrieval, checkpoints, and manuscript protection. Applied to two technical books; this demo is newly prepared for public inspection. <a class="underline" href="/books">Explore the books →</a></p>
</main>
