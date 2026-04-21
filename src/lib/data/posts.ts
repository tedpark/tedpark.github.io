/**
 * Blog post index.
 *
 * Each post is a single ``.md`` file under ``src/lib/data/posts/``.  Vite's
 * ``import.meta.glob`` collects them at build time and feeds the front-matter
 * to the listing + slug routes.  No build-time scripts; no dynamic fetching.
 *
 * Add a new post by:
 *   1. Dropping ``my-post-slug.md`` into ``src/lib/data/posts/``
 *   2. Including the YAML front-matter shown in ``PostFrontmatter`` below
 *   3. Done — the new entry appears in ``/blog`` and is reachable at
 *      ``/blog/my-post-slug`` on the next dev/build cycle.
 */

export type Lang = 'en' | 'ko' | 'ja';

export type PostFrontmatter = {
	title: string;
	subtitle?: string;
	date: string; // ISO YYYY-MM-DD
	tags: string[];
	summary: string;
	draft?: boolean;
	canonical?: string;
	lang?: Lang; // explicit override; auto-detected from slug suffix if absent
};

export type PostMeta = PostFrontmatter & {
	slug: string;
	lang: Lang;
	baseslug: string; // slug without .ko / .ja / .en suffix
	readingTime: number; // minutes (rough)
};

// Eager-glob front-matter from every post file. ``query: '?raw'`` would give
// the raw markdown if we wanted to compute reading time more accurately;
// instead mdsvex exports ``metadata`` for us, which is enough.
const modules = import.meta.glob<{
	metadata: PostFrontmatter;
	default: unknown;
}>('./posts/*.md', { eager: true });

function _slugFromPath(p: string): string {
	const base = p.split('/').pop() ?? '';
	return base.replace(/\.md$/, '');
}

function _langFromSlug(slug: string): Lang {
	if (slug.endsWith('.ko')) return 'ko';
	if (slug.endsWith('.ja')) return 'ja';
	if (slug.endsWith('.en')) return 'en';
	return 'en';
}

function _baseslug(slug: string): string {
	return slug.replace(/\.(ko|ja|en)$/, '');
}

// Rough reading time: count words in the summary as a stable proxy when we
// don't have raw markdown handy in this index module. Posts can override by
// adding ``readingTime`` to front-matter (not yet implemented; KISS for now).
function _approxReadingTime(fm: PostFrontmatter): number {
	const wordCount = fm.summary.split(/\s+/).length * 30; // assume ~30x summary length
	return Math.max(3, Math.round(wordCount / 220));
}

export const posts: PostMeta[] = Object.entries(modules)
	.map(([path, mod]) => {
		const fm = mod.metadata;
		const slug = _slugFromPath(path);
		const lang: Lang = fm.lang ?? _langFromSlug(slug);
		const baseslug = _baseslug(slug);
		return {
			...fm,
			slug,
			lang,
			baseslug,
			readingTime: _approxReadingTime(fm)
		};
	})
	.filter((p) => !p.draft)
	.sort((a, b) => (a.date < b.date ? 1 : -1));

export function getPost(slug: string): PostMeta | undefined {
	return posts.find((p) => p.slug === slug);
}

/** Returns all available language versions for a given baseslug. */
export function getTranslations(baseslug: string): Partial<Record<Lang, PostMeta>> {
	const result: Partial<Record<Lang, PostMeta>> = {};
	for (const p of posts) {
		if (p.baseslug === baseslug) result[p.lang] = p;
	}
	return result;
}
