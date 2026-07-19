// A book's library slug is also the path of its published Hugo site on the org's
// custom domain, so its public page and cover image are pure functions of the
// slug — no per-book config, no lookups. Private repo, public site (Pages).
const BOOK_HOST = 'https://nplus.wiki';

export const bookSiteUrl = (slug: string): string => `${BOOK_HOST}/${slug}/`;
export const bookCoverUrl = (slug: string): string => `${BOOK_HOST}/${slug}/cover.png`;

export type EssayBook = {
  title: string;
  chapter?: string;
  slug?: string;
};
