import { getCollection } from 'astro:content';

// Served at nplus.wiki (org Pages custom domain); keep deep links on that host.
const SITE = 'https://nplus.wiki/bookshelf-echo-site';

/**
 * Machine-readable latest essay (news-echo), consumed by nplus-backend's
 * AiRadarDailyPushJob. The output keys (date/title/pageUrl/newsTitle/newsUrl/
 * excerpt/books) are a stable contract; only the source changed — provenance now
 * comes from structured frontmatter (EssayRenderer) instead of a prose parse.
 * Days without an essay are legal (寧缺勿濫): the payload then has date: null.
 */
export async function GET() {
  const essays = await getCollection('essays');
  const latest = [...essays].sort((a, b) => b.data.date.getTime() - a.data.date.getTime())[0];
  const payload = latest
    ? {
        date: latest.data.date.toISOString().slice(0, 10),
        title: latest.data.title,
        pageUrl: `${SITE}/essays/${latest.id}/`,
        newsTitle: latest.data.news?.title ?? null,
        newsUrl: latest.data.news?.url ?? null,
        excerpt: excerptOf(latest.body ?? ''),
        books: (latest.data.books ?? []).map((b) => ({ title: b.title, chapter: b.chapter ?? null })),
      }
    : { date: null, title: null, pageUrl: null, newsTitle: null, newsUrl: null, excerpt: null, books: [] };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** First ~200 chars of essay prose — skip headings, quotes, lists and rules. */
function excerptOf(body: string): string | null {
  const prose = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^[#>\-*|`]/.test(l));
  return prose.length ? prose.join(' ').slice(0, 200) : null;
}
