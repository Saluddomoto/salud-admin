import { NextResponse } from 'next/server'
import { linePush } from '@salud/line'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 管理者(堂本)のLINEに、短い通知文を1通送る。
// 使い方: GET /api/cron/notify?text=通知文   （Authorization: Bearer CRON_SECRET が必須）
// 例: 作業が終わったときに、確認用のURLを知らせる。外部からは、合言葉(CRON_SECRET)が無いと使えない。
export async function GET(req: Request) {
  const cronSecret  = process.env.CRON_SECRET
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!accessToken) return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です' }, { status: 503 })

  const text = (new URL(req.url).searchParams.get('text') ?? '').trim().slice(0, 1800)
  if (!text) return NextResponse.json({ error: 'text が空です' }, { status: 400 })

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('profiles')
    .select('line_user_id')
    .not('line_user_id', 'is', null).eq('is_active', true).eq('role', 'admin')

  let sent = 0
  for (const m of members ?? []) {
    await linePush(m.line_user_id!, [{ type: 'text', text }], accessToken)
      .then(() => { sent += 1 })
      .catch(e => console.error('notify: line push failed', e))
  }
  return NextResponse.json({ ok: true, sent })
}
