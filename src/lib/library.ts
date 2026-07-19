// A book's library slug is also the path of its published Hugo site on the org's
// custom domain, so its public page and cover image are pure functions of the
// slug — no per-book config, no lookups. Private repo, public site (Pages).
const BOOK_HOST = 'https://nplus.wiki';

export const bookSiteUrl = (slug: string): string => `${BOOK_HOST}/${slug}/`;
export const bookCoverUrl = (slug: string): string => `${BOOK_HOST}/${slug}/cover.png`;

/**
 * The deployed page of a specific chapter. chapter_id is "<slug>:<content-path>"
 * (e.g. "goodman-…:docs/05-hormones/04-androgens/_index.md"); the Hugo Book site
 * serves that path with the _index.md/.md suffix dropped. Returns null when the
 * id has no path part (can't resolve a chapter).
 */
export const chapterUrl = (chapterId: string): string | null => {
  const sep = chapterId.indexOf(':');
  if (sep < 0) return null;
  const slug = chapterId.slice(0, sep);
  let path = chapterId.slice(sep + 1).replace(/_index\.md$/, '').replace(/\.md$/, '/');
  if (!path.endsWith('/')) path += '/';
  return `${BOOK_HOST}/${slug}/${path}`;
};

export type EssayBook = {
  title: string;
  chapter?: string;
  slug?: string;
  // "<slug>:<content-path>" — lets the front-end deep-link to the chapter page.
  chapter_id?: string;
};
