import { NextResponse } from 'next/server'
import { syncGoogleMeetMinutes } from '@/lib/google'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Meet 議事録の手動同期(設定画面の「今すぐ同期」から呼ばれる)
export async function GET(req: Request) {
  const { data: { user } } = await createServerSupabaseClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const force = new URL(req.url).searchParams.get('force') === '1'
  const result = await syncGoogleMeetMinutes({ force })
  return NextResponse.json({ ok: true, ...result })
}
