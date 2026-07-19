import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// The pipeline writes markdown into content/daily and content/weekly.
// Astro 5 Content Layer globs them straight from those directories.
const daily = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/daily' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    itemCount: z.number().optional(),
  }),
});

const weekly = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/weekly' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    itemCount: z.number().optional(),
    highlightCount: z.number().optional(),
  }),
});

// news-echo：每日一篇書櫃評析（可缺席——「有共鳴才寫」是合法輸出）。
// news/books 由 pipeline 的 EssayRenderer 寫進 frontmatter（結構化三元組）；全
// optional，讓改版前、無這些欄位的舊 essay 仍能通過驗證並優雅降級。
const essays = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/essays' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    kind: z.string().optional(),
    news: z
      .object({
        title: z.string(),
        url: z.string(),
        source: z.string().optional(),
        summary: z.string().optional(),
      })
      .optional(),
    // slug == library book id == 已發佈書站路徑 nplus.wiki/<slug>/。
    books: z
      .array(
        z.object({
          title: z.string(),
          chapter: z.string().optional(),
          slug: z.string().optional(),
          chapter_id: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export const collections = { daily, weekly, essays };
