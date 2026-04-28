<script lang="ts">
	import SiteNav from '$lib/components/SiteNav.svelte';

	let query = $state('');
	let answer = $state('');
	let loading = $state(false);
	let events: Array<{node: string, detail: string}> = $state([]);
	let apiUrl = $state('');
	let showConfig = $state(false);

	const sampleQueries = [
		'What is pair trading and how does QR-DQN improve it?',
		'Explain the Self-RAG hallucination guard',
		'How does Thompson Sampling select the best retriever?',
		'What is CVaR-based position sizing?',
		'Compare SAC vs PPO vs QR-DQN for trading',
	];

	async function search() {
		if (!query.trim() || !apiUrl.trim()) return;
		loading = true;
		answer = '';
		events = [];

		try {
			const res = await fetch(`${apiUrl}/langgraph/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ question: query, use_user_docs: false }),
			});

			if (!res.ok) {
				answer = `Error: ${res.status} ${res.statusText}`;
				loading = false;
				return;
			}

			const reader = res.body?.getReader();
			const decoder = new TextDecoder();

			if (reader) {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					const text = decoder.decode(value);
					for (const line of text.split('\n').filter(Boolean)) {
						try {
							const evt = JSON.parse(line);
							events = [...events, {
								node: evt.node || '?',
								detail: evt.answer ? `${evt.answer.slice(0, 100)}...` :
									evt.n_docs ? `${evt.n_docs} docs` :
									evt.route || evt.relevance_score?.toString() || ''
							}];
							if (evt.answer) answer = evt.answer;
						} catch {}
					}
				}
			}
		} catch (e: any) {
			answer = `Connection failed: ${e.message}. Make sure the API server is running.`;
		}
		loading = false;
	}

	function selectSample(q: string) {
		query = q;
	}
</script>

<div class="min-h-screen">
	<SiteNav />

	<section class="max-w-4xl mx-auto px-6 pt-32 pb-20">
		<h1 class="text-4xl font-bold mb-2">RAG Pipeline Demo</h1>
		<p class="text-foreground/60 mb-8">
			Interactive demo of the LangGraph 8-node RAG + Multi-Agent system.
			Watch each node execute in real-time via NDJSON streaming.
		</p>

		<!-- API Config -->
		<div class="mb-6">
			<button
				class="text-sm text-foreground/50 hover:text-foreground/80 underline"
				onclick={() => showConfig = !showConfig}
			>
				{showConfig ? 'Hide' : 'Show'} API Configuration
			</button>
			{#if showConfig}
				<div class="mt-2 p-4 rounded-lg bg-muted/30 border border-border">
					<label class="block text-sm font-mono text-foreground/60 mb-1">API Server URL</label>
					<input
						type="text"
						bind:value={apiUrl}
						placeholder="http://localhost:8000"
						class="w-full px-3 py-2 rounded border border-border bg-background text-foreground font-mono text-sm"
					/>
					<p class="text-xs text-foreground/40 mt-1">
						Run the ChatBout AI server locally:
						<code class="bg-muted px-1 rounded">uvicorn main:app --port 8000</code>
					</p>
				</div>
			{/if}
		</div>

		<!-- Sample Queries -->
		<div class="mb-4">
			<p class="text-sm text-foreground/50 mb-2">Try a sample query:</p>
			<div class="flex flex-wrap gap-2">
				{#each sampleQueries as sq}
					<button
						class="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors"
						onclick={() => selectSample(sq)}
					>
						{sq.slice(0, 50)}{sq.length > 50 ? '...' : ''}
					</button>
				{/each}
			</div>
		</div>

		<!-- Search Input -->
		<div class="flex gap-2 mb-6">
			<input
				type="text"
				bind:value={query}
				placeholder="Ask anything..."
				class="flex-1 px-4 py-3 rounded-lg border border-border bg-background text-foreground"
				onkeydown={(e) => e.key === 'Enter' && search()}
			/>
			<button
				onclick={search}
				disabled={loading || !query.trim() || !apiUrl.trim()}
				class="px-6 py-3 rounded-lg bg-foreground text-background font-medium disabled:opacity-40 hover:opacity-80 transition-opacity"
			>
				{loading ? 'Processing...' : 'Ask'}
			</button>
		</div>

		{#if !apiUrl.trim()}
			<div class="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 text-sm">
				Configure the API server URL above to start. The demo connects to your local ChatBout AI instance.
			</div>
		{/if}

		<!-- Pipeline Events -->
		{#if events.length > 0}
			<div class="mb-6">
				<h3 class="text-sm font-mono text-foreground/50 mb-2">Pipeline Execution</h3>
				<div class="space-y-1">
					{#each events as evt, i}
						<div class="flex items-center gap-2 text-sm font-mono py-1 px-3 rounded bg-muted/20">
							<span class="text-green-500">&#x2713;</span>
							<span class="text-foreground/70 font-medium min-w-[140px]">{evt.node}</span>
							<span class="text-foreground/40 truncate">{evt.detail}</span>
						</div>
					{/each}
					{#if loading}
						<div class="flex items-center gap-2 text-sm font-mono py-1 px-3 rounded bg-muted/20 animate-pulse">
							<span class="text-yellow-500">&#x25CB;</span>
							<span class="text-foreground/50">processing...</span>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Answer -->
		{#if answer}
			<div class="p-6 rounded-lg border border-border bg-muted/10">
				<h3 class="text-sm font-mono text-foreground/50 mb-3">Answer</h3>
				<div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
					{answer}
				</div>
			</div>
		{/if}

		<!-- Architecture Info -->
		<div class="mt-12 p-6 rounded-lg border border-border bg-muted/5">
			<h3 class="text-lg font-bold mb-4">How It Works</h3>
			<pre class="text-xs font-mono text-foreground/60 overflow-x-auto">classify &#x2192; query_transform &#x2192; retrieve &#x2192; rerank &#x2192; grade &#x2192; generate &#x2192; hallucination_check
  &#x2193; chitchat     &#x2191; (retry)                                    &#x2193; (hallucinated &#x2192; retry)
  generate &#x2190;&#x2500;&#x2500;&#x2500;&#x2518;                                              generate</pre>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
				<div class="p-2 rounded bg-muted/20">
					<div class="font-medium">HyDE</div>
					<div class="text-foreground/50">Hypothetical doc as query</div>
				</div>
				<div class="p-2 rounded bg-muted/20">
					<div class="font-medium">Cross-Encoder</div>
					<div class="text-foreground/50">ms-marco rerank top-4</div>
				</div>
				<div class="p-2 rounded bg-muted/20">
					<div class="font-medium">RL Bandit</div>
					<div class="text-foreground/50">Thompson Sampling retriever</div>
				</div>
				<div class="p-2 rounded bg-muted/20">
					<div class="font-medium">Self-RAG</div>
					<div class="text-foreground/50">Hallucination guard</div>
				</div>
			</div>
			<p class="text-xs text-foreground/40 mt-4">
				Source: <a href="https://github.com/tedpark/chatbout_ai_py" class="underline">github.com/tedpark/chatbout_ai_py</a>
				&#x2022; 11 API endpoints &#x2022; Docker deployment &#x2022; RAGAS evaluation
			</p>
		</div>
	</section>
</div>
