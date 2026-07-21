import { z } from 'astro:content';

/**
 * pipeline 快照的讀取層。快照由另一個 repo（bookshelf-echo 的 SnapshotJob）
 * 寫出，這裡是唯一的讀入口。
 *
 * 以前 dashboard 直接 `JSON.parse` 成 `any`，每個欄位都 `?.x ?? 預設值`——
 * 寫端改了欄位名，兩邊 build 都綠燈，只有頁面上少一塊。改成 schema 之後，
 * 對不上的欄位會在 build log 印出來（見 loadSnapshot），而不是靜靜消失。
 *
 * 欄位仍全部 optional 並帶預設值：快照是「盡力而為」的健康資料，缺一塊要能
 * 降級渲染，不能讓整個站 build 失敗。對應的寫端測試是 SnapshotJobTest。
 */
export const snapshotSchema = z.object({
  capturedAt: z.string().optional(),
  // publisher 自報的拍攝間隔；沒有就退回每小時（publisher 的預設值）。
  snapshotIntervalMinutes: z.number().default(60),
  queues: z
    .array(
      z.object({
        name: z.string(),
        messages: z.number().default(0),
        messages_ready: z.number().default(0),
        messages_unacknowledged: z.number().default(0),
        consumers: z.number().default(0),
      }),
    )
    .default([]),
  items: z.record(z.string(), z.number()).default({}),
  llmToday: z
    .object({
      costUsd: z.number().default(0),
      inputTokens: z.number().default(0),
      outputTokens: z.number().default(0),
      calls: z.number().default(0),
    })
    .default({ costUsd: 0, inputTokens: 0, outputTokens: 0, calls: 0 }),
  // 花費拆帳：用途 × 模型。舊快照沒有這個欄位，dashboard 整段不顯示。
  llmTodayByPurpose: z
    .array(
      z.object({
        purpose: z.string(),
        model: z.string(),
        costUsd: z.number().default(0),
        inputTokens: z.number().default(0),
        outputTokens: z.number().default(0),
        calls: z.number().default(0),
      }),
    )
    .default([]),
  limits: z
    .object({
      dailyBudgetUsd: z.number().nullable().default(null),
      dailyDigestLimit: z.number().nullable().default(null),
      shortlistMaxPerDay: z.number().nullable().default(null),
      matchNoResonanceDistance: z.number().nullable().default(null),
    })
    .default({
      dailyBudgetUsd: null,
      dailyDigestLimit: null,
      shortlistMaxPerDay: null,
      matchNoResonanceDistance: null,
    }),
  shortlist: z.object({ pendingCount: z.number().default(0) }).default({ pendingCount: 0 }),
  receivedLast24h: z.number().default(0),
});

export type Snapshot = z.infer<typeof snapshotSchema>;

/**
 * 讀 public/data/metrics/latest.json。檔案不存在（fresh clone、首次同步前）
 * 回 null，頁面顯示佔位訊息。
 *
 * schema 對不上時同樣回 null，但**會印出 warning**——這是重點：契約破了要有
 * 聲音，即使頁面選擇降級。
 */
export async function loadSnapshot(): Promise<Snapshot | null> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(process.cwd(), 'public/data/metrics/latest.json'), 'utf-8');
  } catch {
    return null;
  }

  const json = JSON.parse(raw);
  const parsed = snapshotSchema.safeParse(json);
  if (!parsed.success) {
    console.warn(
      '[dashboard] 快照不符合 schema，可能是 SnapshotJob 改了欄位：\n' +
        JSON.stringify(parsed.error.issues, null, 2),
    );
    return null;
  }
  warnOnDrift(json);
  return parsed.data;
}

/**
 * 欄位改名的偵測。
 *
 * safeParse 抓不到改名：未知的鍵被忽略，消失的鍵套上預設值，兩邊都「成功」——
 * 而這正是這一層要防的事故形狀（把 llmTodayByPurpose 改成別的名字，dashboard
 * 只會少一塊，沒有人會知道）。所以另外比對頂層鍵集合。
 *
 * 只警告、不擋渲染：publisher 新增欄位是合法的向前相容變更，不該讓整個
 * dashboard 變成佔位訊息。少掉的鍵才是真的要看的那一個。
 */
function warnOnDrift(json: Record<string, unknown>) {
  const expected = Object.keys(snapshotSchema.shape);
  const actual = Object.keys(json);
  const missing = expected.filter((k) => !actual.includes(k) && k !== 'capturedAt');
  const unknown = actual.filter((k) => !expected.includes(k));
  if (missing.length) {
    console.warn(
      `[dashboard] 快照缺少預期欄位 ${missing.join(', ')}` +
        (unknown.length ? `，但多了 ${unknown.join(', ')}——像是改名` : '——publisher 版本可能比較舊'),
    );
  } else if (unknown.length) {
    console.warn(`[dashboard] 快照有這一版不認得的欄位 ${unknown.join(', ')}；這一頁沒有顯示它們`);
  }
}

/**
 * 快照有多舊。publisher 曾在 2026-07-19 靜默停寫 12 小時，而 dashboard 照樣
 * 顯示一個看似正常的時間戳——過期的快照和健康的快照長得一模一樣。這裡把
 * 「多久沒更新」變成頁面上看得見的狀態。
 *
 * 門檻對著 SNAPSHOT_INTERVAL_MINUTES（預設每小時一次）：兩倍算過期，四倍算
 * 停擺。
 */
export function snapshotAge(capturedAt: string | undefined, now: Date, intervalMinutes = 60) {
  if (!capturedAt) return null;
  const ms = now.getTime() - new Date(capturedAt).getTime();
  if (Number.isNaN(ms)) return null;
  const minutes = ms / 60000;
  const severity = minutes > intervalMinutes * 4 ? 'critical' : minutes > intervalMinutes * 2 ? 'warning' : 'good';
  return { minutes, severity };
}

/** 人話的「多久以前」。 */
export function humanAge(minutes: number): string {
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${Math.round(minutes)} 分鐘前`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} 小時前`;
  return `${Math.round(minutes / (60 * 24))} 天前`;
}
