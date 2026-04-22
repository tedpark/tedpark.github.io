<!--
SiteNav — top fixed nav, shared by ``/`` and ``/blog``.

Keeps the same monospace label aesthetic as the original portfolio page.
The ``label`` prop lets each route brand its own header (e.g. PORTFOLIO / BLOG)
without forking a second nav.
-->
<script lang="ts">
	let { label = 'Ted Park' }: { label?: string } = $props();
</script>

<nav
	class="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/85 backdrop-blur-md"
>
	<div class="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
		<a
			href="/"
			class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-[0.2em]"
		>{label}</a>
		<div class="flex items-center gap-6">
			<a
				href="/portfolio"
				class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-[0.2em]"
			>Portfolio</a>
			<a
				href="/blog"
				class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-[0.2em]"
			>Blog</a>
			<a
				href="/books"
				class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-[0.2em]"
			>Books</a>
			<a
				href="mailto:itstedpark@gmail.com"
				class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono"
			>itstedpark@gmail.com</a>
			<a
				href="https://github.com/tedpark"
				target="_blank"
				rel="noopener noreferrer"
				class="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono"
			>github.com/tedpark ↗</a>
		</div>
	</div>
</nav>
