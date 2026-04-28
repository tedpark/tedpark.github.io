import adapter from '@sveltejs/adapter-static';
import { mdsvex } from 'mdsvex';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHighlighter } from 'shiki';

const _projectRoot = dirname(fileURLToPath(import.meta.url));

// Pre-build the shiki highlighter once (reused across all mdsvex compilations).
const shikiHighlighter = await createHighlighter({
	themes: ['github-dark', 'github-light'],
	langs: ['python', 'typescript', 'javascript', 'bash', 'json', 'yaml', 'rust', 'sql', 'html', 'css', 'svelte', 'diff', 'toml', 'dockerfile']
});

/**
 * mdsvex highlight function powered by shiki.
 * Returns HTML string with inline styles (no external CSS needed).
 */
function shikiHighlight(code, lang) {
	if (!lang) lang = 'text';
	try {
		let html = shikiHighlighter.codeToHtml(code, {
			lang,
			themes: { dark: 'github-dark', light: 'github-light' },
			defaultColor: 'dark'
		});
		// Escape curly braces so Svelte doesn't interpret them as expressions.
		// Only escape inside <code> content, not in HTML attributes.
		html = html.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
		return html;
	} catch {
		const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
		return `<pre><code>${escaped}</code></pre>`;
	}
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.svx', '.md'],
	preprocess: [
		mdsvex({
			extensions: ['.svx', '.md'],
			layout: {
				_: resolve(_projectRoot, 'src/lib/components/blog/PostLayout.svelte')
			},
			smartypants: false,
			highlight: {
				highlighter: async (code, lang) => shikiHighlight(code, lang)
			}
		})
	],
	compilerOptions: {
		// Runes mode for our own .svelte files, but not for mdsvex output
		// (.md / .svx) which still uses legacy $$props in its generated wrapper.
		runes: ({ filename }) => {
			const parts = filename.split(/[/\\]/);
			if (parts.includes('node_modules')) return undefined;
			if (filename.endsWith('.md') || filename.endsWith('.svx')) return false;
			return true;
		}
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			precompress: false,
			strict: true
		})
	}
};

export default config;
