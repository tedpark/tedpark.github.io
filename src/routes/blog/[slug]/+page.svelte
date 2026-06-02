<script lang="ts">
	import SiteNav from '$lib/components/SiteNav.svelte';
	import type { PageProps } from './$types';
	import type { Lang } from '$lib/data/posts';

	let { data }: PageProps = $props();

	const langLabel: Record<Lang, string> = { en: 'English', ko: 'Korean', ja: 'Japanese' };
	const langOrder: Lang[] = ['en', 'ko', 'ja'];

	// available langs sorted by preferred order
	const availableLangs = langOrder.filter((l) => l in data.translations);
</script>

<svelte:head>
	<title>{data.post.title} · Ted Park</title>
	<meta name="description" content={data.post.summary} />
	{#if data.post.canonical}
		<link rel="canonical" href={data.post.canonical} />
	{/if}
	<meta property="og:title" content={data.post.title} />
	<meta property="og:description" content={data.post.summary} />
	<meta property="og:type" content="article" />
	<meta property="article:published_time" content={data.post.date} />
</svelte:head>

<div class="min-h-screen">
	<SiteNav label="Blog" />

	<!-- Header -->
	<header class="max-w-3xl mx-auto px-6 pt-40 pb-10">
		<div class="flex items-center justify-between gap-3 mb-6">
			<a
				href="/blog"
				class="text-[10px] font-mono text-muted-foreground/60 hover:text-foreground transition-colors tracking-[0.15em] uppercase"
			>← All posts</a>

			<!-- Language switcher (only when translations exist) -->
			{#if availableLangs.length > 1}
				<div class="flex items-center gap-1">
					{#each availableLangs as lang}
						{@const t = data.translations[lang]}
						{#if t}
							{#if lang === data.post.lang}
								<span class="text-[10px] font-mono px-2.5 py-1 rounded border border-foreground/30 text-foreground bg-foreground/5">
									{langLabel[lang]}
								</span>
							{:else}
								<a
									href={`/blog/${t.slug}`}
									class="text-[10px] font-mono px-2.5 py-1 rounded border border-border/40 text-muted-foreground/70 hover:text-foreground hover:border-foreground/30 transition-colors"
								>{langLabel[lang]}</a>
							{/if}
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<h1 class="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
			{data.post.title}
		</h1>

		{#if data.post.subtitle}
			<p class="text-foreground/55 text-lg mb-6 leading-relaxed">{data.post.subtitle}</p>
		{/if}

		<div class="flex flex-wrap items-center gap-3 mb-8">
			<time
				class="text-[11px] font-mono text-muted-foreground tracking-[0.15em] uppercase"
				datetime={data.post.date}
			>
				{data.post.date}
			</time>
			<span class="text-border/80">·</span>
			<span class="text-[11px] font-mono text-muted-foreground">
				{data.post.readingTime} min read
			</span>
			<span class="text-border/80">·</span>
			<div class="flex flex-wrap gap-2">
				{#each data.post.tags as tag}
					<span
						class="text-[10px] font-mono text-muted-foreground/70 px-2 py-0.5 border border-border/60 rounded"
					>{tag}</span>
				{/each}
			</div>
		</div>
	</header>

	<!-- Body — mdsvex layout adds .prose-blog wrapper for typography -->
	<section class="max-w-3xl mx-auto px-6 pb-24">
		<data.Component />
	</section>

	<!-- Footer -->
	<footer class="border-t border-border/50">
		<div class="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
			<a
				href="/blog"
				class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono"
			>← Back to blog</a>
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
