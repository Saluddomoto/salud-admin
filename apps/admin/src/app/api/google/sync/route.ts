import { NextResponse } from 'next/server'
import { syncGoogleCalendars } from '@/lib/google'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// カレンダー同期（スケジュール画面の表示時などに呼ばれる。10分以内の再同期はスキップ）
export async function GET(req: Request) {
  const { data: { user } } = await createServerSupabaseClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const force = new URL(req.url).searchParams.get('force') === '1'
  const result = await syncGoogleCalendars({ force })
  return NextResponse.json({ ok: true, ...result })
}
