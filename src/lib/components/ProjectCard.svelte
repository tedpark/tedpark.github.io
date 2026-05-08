<script lang="ts">
	import type { Project } from '$lib/data/projects';
	import { techIconPaths } from '$lib/utils/techIcons';
	import { techLinks } from '$lib/utils/techLinks';

	let { project, index }: { project: Project; index: number } = $props();

	let activeIndex = $state(0);
	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);

	function openLightbox(idx: number) {
		lightboxIndex = idx;
		lightboxOpen = true;
	}

	function closeLightbox() {
		lightboxOpen = false;
	}

	function prev() {
		if (project.screenshots.length === 0) return;
		lightboxIndex = (lightboxIndex - 1 + project.screenshots.length) % project.screenshots.length;
	}

	function next() {
		if (project.screenshots.length === 0) return;
		lightboxIndex = (lightboxIndex + 1) % project.screenshots.length;
	}

	function handleKey(e: KeyboardEvent) {
		if (!lightboxOpen) return;
		if (e.key === 'Escape') closeLightbox();
		if (e.key === 'ArrowLeft') prev();
		if (e.key === 'ArrowRight') next();
	}

	const numberLabel = $derived(['01', '02', '03'][index] ?? String(index + 1).padStart(2, '0'));
</script>

<svelte:window onkeydown={handleKey} />

<div class="flex flex-col gap-12">

	<!-- ① Identity -->
	<div class="flex items-start gap-6">
		<span class="text-[5rem] font-bold text-foreground/[0.07] font-mono tabular-nums leading-none select-none flex-none -mt-1">
			{numberLabel}
		</span>
		<div class="flex flex-col gap-2 pt-1">
			<span class="text-[11px] font-mono text-muted-foreground tracking-[0.28em] uppercase">
				{project.period}
			</span>
			<h2 class="text-3xl md:text-[2.5rem] font-bold tracking-tight text-foreground leading-tight">
				{project.title}
			</h2>
			<p class="text-base text-foreground/60">{project.subtitle}</p>
		</div>
	</div>

	<!-- ② Evidence panel / Screenshot -->
	{#if project.screenshots.length > 0}
		<div class="flex flex-col gap-3">
			<div class="rounded-2xl p-px bg-white/[0.15]">
				<button
					type="button"
					class="group w-full overflow-hidden rounded-[15px] hover:brightness-105 transition-all duration-300 cursor-zoom-in block"
					onclick={() => openLightbox(activeIndex)}
				>
					<img
						src={project.screenshots[activeIndex].src}
						alt={project.screenshots[activeIndex].alt}
						class="w-full object-cover block group-hover:scale-[1.015] transition-transform duration-700 ease-out"
						loading={index === 0 ? 'eager' : 'lazy'}
					/>
				</button>
			</div>

			{#if project.screenshots.length > 1}
				<div class="flex gap-2 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
					{#each project.screenshots as shot, idx}
						<div
							class="flex-none rounded-[9px] p-px transition-all duration-200 {activeIndex === idx
								? 'bg-white/60 shadow-[0_0_10px_rgba(255,255,255,0.12)]'
								: 'bg-white/[0.07] hover:bg-white/20'}"
						>
							<button
								type="button"
								class="w-16 h-10 rounded-[8px] overflow-hidden block cursor-pointer transition-all duration-200 {activeIndex === idx
									? 'opacity-100'
									: 'opacity-35 hover:opacity-65'}"
								onclick={() => (activeIndex = idx)}
							>
								<img src={shot.src} alt={shot.alt} class="w-full h-full object-cover" />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="rounded-2xl p-px bg-white/[0.15]">
			<div class="rounded-[15px] border border-white/[0.06] bg-[#111] px-5 py-6 md:px-7 md:py-8">
				<div class="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4 mb-5">
					<p class="text-[11px] font-mono uppercase tracking-[0.24em] text-muted-foreground">
						System evidence
					</p>
					<span class="text-[11px] font-mono text-foreground/35">{project.title}</span>
				</div>
				<div class="grid md:grid-cols-3 gap-3">
					{#each project.reviewerSummary as item}
						<div class="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
							<p class="text-sm leading-relaxed text-foreground/72">{item}</p>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- ③ Metrics -->
	<div class="grid sm:grid-cols-3 gap-px bg-white/[0.07] rounded-xl overflow-hidden ring-1 ring-white/[0.07]">
		{#each project.metrics as metric}
			<div class="bg-[#141414] px-5 py-4 flex flex-col gap-1.5">
				<p class="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">{metric.label}</p>
				<p class="text-2xl font-bold tabular-nums tracking-tight text-foreground">{metric.value}</p>
			</div>
		{/each}
	</div>

	<!-- ④ Description -->
	<div class="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] gap-8 items-start">
		<p class="text-foreground/75 text-[16px] md:text-[17px] leading-[1.8]">
			{project.description}
		</p>

		<div class="rounded-md border border-white/[0.09] bg-white/[0.035] p-4">
			<p class="text-[11px] font-mono text-muted-foreground tracking-[0.2em] uppercase mb-4">
				Reviewer quick read
			</p>
			<ul class="flex flex-col gap-3">
				{#each project.reviewerSummary as item}
					<li class="flex gap-3 items-start">
						<span class="flex-none mt-[7px] w-[5px] h-[5px] rounded-full bg-foreground/45"></span>
						<span class="text-sm text-foreground/75 leading-relaxed">{item}</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>

	<!-- ⑤ Highlights -->
	<div class="grid sm:grid-cols-2 gap-x-12 gap-y-4">
		{#each project.highlights as h}
			<div class="flex gap-3.5 items-start">
				<span class="flex-none mt-[7px] w-[5px] h-[5px] rounded-full bg-foreground/40 ring-[3px] ring-foreground/[0.08]"></span>
				<span class="text-sm text-foreground/72 leading-relaxed">{h}</span>
			</div>
		{/each}
	</div>

	<!-- ⑥ Stack -->
	<div class="flex flex-wrap gap-1.5 pt-3 border-t border-white/[0.07]">
		{#each project.tags as tag}
			{@const iconPath = techIconPaths[tag]}
			{@const href = techLinks[tag]}
			{#if href}
				<a
					{href}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-[5px] rounded-md bg-white/[0.05] border border-white/[0.07] text-foreground/55 hover:text-foreground/80 hover:bg-white/[0.09] hover:border-white/[0.18] transition-colors"
				>
					{#if iconPath}
						<svg viewBox="0 0 24 24" class="w-3 h-3 flex-none opacity-70" fill="currentColor" aria-hidden="true">
							<path d={iconPath} />
						</svg>
					{/if}
					{tag}
				</a>
			{:else}
				<span class="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-[5px] rounded-md bg-white/[0.05] border border-white/[0.07] text-foreground/55 cursor-default">
					{#if iconPath}
						<svg viewBox="0 0 24 24" class="w-3 h-3 flex-none opacity-70" fill="currentColor" aria-hidden="true">
							<path d={iconPath} />
						</svg>
					{/if}
					{tag}
				</span>
			{/if}
		{/each}
	</div>

</div>


<!-- Lightbox -->
{#if lightboxOpen}
	<div
		class="fixed inset-0 z-[200] bg-black/96 flex items-center justify-center"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={closeLightbox}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') closeLightbox();
		}}
	>
		<!-- Top bar -->
		<div class="absolute top-0 inset-x-0 h-14 flex items-center justify-between px-6">
			<div class="flex items-center gap-3">
				<span class="text-xs font-mono text-white/30">{project.title}</span>
				<span class="text-white/15">·</span>
				<span class="text-xs font-mono text-white/25 tabular-nums">
					{lightboxIndex + 1} / {project.screenshots.length}
				</span>
			</div>
			<button
				type="button"
				class="text-[11px] font-mono text-white/30 hover:text-white/70 transition-colors tracking-widest uppercase"
				onclick={closeLightbox}
			>
				Close
			</button>
		</div>

		<!-- Image -->
		<div
			class="max-w-[90vw] max-h-[80vh]"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<img
				src={project.screenshots[lightboxIndex].src}
				alt={project.screenshots[lightboxIndex].alt}
				class="max-w-[90vw] max-h-[80vh] object-contain rounded-xl shadow-2xl"
			/>
		</div>

		<!-- Prev / Next -->
		{#if project.screenshots.length > 1}
			<button
				type="button"
				class="absolute left-5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/6 hover:bg-white/12 text-white/50 hover:text-white text-xl transition-all"
				onclick={(e) => { e.stopPropagation(); prev(); }}
				aria-label="Previous"
			>‹</button>
			<button
				type="button"
				class="absolute right-5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/6 hover:bg-white/12 text-white/50 hover:text-white text-xl transition-all"
				onclick={(e) => { e.stopPropagation(); next(); }}
				aria-label="Next"
			>›</button>
		{/if}

		<!-- Dot strip -->
		<div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
			{#each project.screenshots as _, idx}
				<button
					type="button"
					class="transition-all duration-200 rounded-full {lightboxIndex === idx
						? 'w-4 h-1.5 bg-white/80'
						: 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'}"
					onclick={(e) => { e.stopPropagation(); lightboxIndex = idx; }}
					aria-label={`Screenshot ${idx + 1}`}
				></button>
			{/each}
		</div>
	</div>
{/if}
