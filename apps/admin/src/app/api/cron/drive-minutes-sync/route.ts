import { NextResponse } from 'next/server'
import { syncGoogleMeetMinutes } from '@/lib/google'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Google Meet 議事録(Meet Recordings フォルダ)の定期取り込み。
// daily-digest と同じく Vercel Cron から CRON_SECRET 付きで叩く想定。
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: 'Google 環境変数が未設定です' }, { status: 503 })
  }

  const result = await syncGoogleMeetMinutes({ force: true })
  return NextResponse.json({ ok: true, ...result })
}
