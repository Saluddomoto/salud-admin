import { AsyncLocalStorage } from 'node:async_hooks'

// AI利用料の集計。trackUsage() の中で行われた Claude API 呼び出しのトークン数を合算し、概算料金（米ドル）を返す。
// 単価は Anthropic 公表の API 料金（100万トークンあたり）。モデルを追加したらここへ足す。
const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

export interface UsageTotals {
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** ウェブ検索の実行回数（検索そのものの課金は、トークン料金に含まない） */
  webSearches: number
  /** トークン料金のみの概算（米ドル）。単価が未登録のモデルは0として数える */
  costUsd: number
  models: string[]
}

const store = new AsyncLocalStorage<UsageTotals>()

const emptyTotals = (): UsageTotals => ({
  calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, costUsd: 0, models: [],
})

interface ApiUsage {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
  server_tool_use?: { web_search_requests?: number | null } | null
}

/** Claude API の応答の usage を、実行中の集計へ加える（trackUsage の外で呼ばれても何も起きない） */
export function recordUsage(model: string, usage: ApiUsage | undefined | null): void {
  const t = store.getStore()
  if (!t || !usage) return
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  const price = PRICES_USD_PER_MTOK[model]
  t.calls += 1
  t.inputTokens += input
  t.outputTokens += output
  t.cacheReadTokens += cacheRead
  t.cacheWriteTokens += cacheWrite
  t.webSearches += usage.server_tool_use?.web_search_requests ?? 0
  if (price) {
    // キャッシュ読み取りは入力単価の0.1倍、書き込みは1.25倍
    t.costUsd += (input * price.input + cacheRead * price.input * 0.1 + cacheWrite * price.input * 1.25 + output * price.output) / 1_000_000
  }
  if (!t.models.includes(model)) t.models.push(model)
}

/** fn の中で行われた Claude API 呼び出しの利用量を集計して、結果と一緒に返す */
export async function trackUsage<T>(fn: () => Promise<T>): Promise<{ result: T; usage: UsageTotals }> {
  const totals = emptyTotals()
  const result = await store.run(totals, fn)
  return { result, usage: totals }
}
