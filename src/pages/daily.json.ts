import { getCollection } from 'astro:content';
import { parseDigest } from '../lib/digest';

// Served at nplus.wiki (org Pages custom domain); keep deep links on that host.
const SITE = 'https://nplus.wiki/bookshelf-echo-site';

/**
 * Machine-readable latest daily digest, consumed by nplus-backend's
 * AiRadarDailyPushJob (same public-JSON contract style as
 * nplus.wiki/goal-tracker/progress.json). The markdown parse lives in
 * ../lib/digest so the homepage News Digest and this contract share one parser.
 */
export async function GET() {
  const daily = await getCollection('daily');
  const latest = [...daily].sort((a, b) => b.data.date.getTime() - a.data.date.getTime())[0];
  const payload = latest
    ? {
        date: latest.data.date.toISOString().slice(0, 10),
        itemCount: latest.data.itemCount ?? null,
        pageUrl: `${SITE}/daily/${latest.id}/`,
        ...parseDigest(latest.body ?? ''),
      }
    : { date: null, itemCount: null, pageUrl: null, highlights: [], alsoSeen: [] };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
