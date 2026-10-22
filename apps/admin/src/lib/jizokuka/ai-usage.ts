import { NextResponse } from 'next/server'
import { trackUsage } from '@salud/ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// 為替の換算レート（概算表示用。実際の請求額は為替と、トークン以外の料金（ウェブ検索など）で変わる）
export const JPY_PER_USD = 150

/**
 * API ハンドラの中で行われた Claude API 呼び出しの利用量を集計し、案件ごとの利用料として保存する。
 * 応答ヘッダー X-AI-Cost-Yen に今回の概算（円）を載せる。記録に失敗しても、本来の応答は返す。
 */
export async function runTracked(
  operation: string,
  resolveCaseId: () => Promise<string | null | undefined>,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const { result, usage } = await trackUsage(handler)
  if (usage.calls > 0) {
    try {
      const caseId = await resolveCaseId()
      if (caseId) {
        await createServerSupabaseClient().schema('jizokuka').from('case_ai_usage').insert({
          case_id: caseId,
          operation,
          models: usage.models.join(','),
          calls: usage.calls,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          cache_read_tokens: usage.cacheReadTokens,
          cache_write_tokens: usage.cacheWriteTokens,
          web_searches: usage.webSearches,
          cost_usd: usage.costUsd,
        })
      }
    } catch (e) {
      console.error('持続化パイロット: AI利用料の記録に失敗', e)
    }
    result.headers.set('X-AI-Cost-Yen', String(Math.round(usage.costUsd * JPY_PER_USD * 10) / 10))
  }
  return result
}
