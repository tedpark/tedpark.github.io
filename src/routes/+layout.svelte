<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Ted Park — AI / ML Engineer</title>
	<meta name="description" content="Ted Park is an AI / ML engineer building production systems across RAG agents, financial ML, model serving, and technical writing." />
	<meta name="theme-color" content="#0a0a0a" />
</svelte:head>

<div class="min-h-screen bg-background text-foreground antialiased font-sans">
	{@render children()}
</div>
