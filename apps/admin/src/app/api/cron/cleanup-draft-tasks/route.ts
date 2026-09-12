import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STALE_THRESHOLD_MS = 3 * 24 * 3600_000 // 検出から3日経っても未承認（=タスク未追加）の下書きは削除

// LINEグループの発言からAIが検出したタスク候補（tasks.source='ai_line', reviewed_at IS NULL）のうち、
// 3日経っても承認（タスク追加）も却下もされなかったものを自動で削除する。
// Supabase pg_cron から毎日1回起動。
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const threshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .delete()
    .eq('source', 'ai_line')
    .is('reviewed_at', null)
    .lt('created_at', threshold)
    .select('id')

  if (error) {
    console.error('cleanup-draft-tasks: failed', error)
    return NextResponse.json({ error: 'cleanup failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: data?.length ?? 0 })
}
