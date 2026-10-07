<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Ted Park — AI Agents &amp; Backend Systems</title>
	<meta name="description" content="Ted Park is a senior software engineer building AI agents, backend systems, retrieval workflows, and publishing tools." />
	<meta name="theme-color" content="#0a0a0a" />
</svelte:head>

<div class="min-h-screen bg-background text-foreground antialiased font-sans">
	{@render children()}
</div>
