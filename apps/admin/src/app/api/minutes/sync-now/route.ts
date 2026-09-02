import { NextResponse } from 'next/server'
import { syncGoogleMeetMinutes } from '@/lib/google'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 議事録一覧の「今すぐ取込」ボタンから叩かれる、Google Meet 議事録の即時同期。
// cron/drive-minutes-sync と同じ処理をログイン済みユーザーの操作で即時実行する
// （middleware によりログイン必須。CRON_SECRET は不要）。
export async function POST() {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: 'Google 環境変数が未設定です' }, { status: 503 })
  }

  try {
    const result = await syncGoogleMeetMinutes({ force: true })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('議事録の即時同期に失敗', e)
    return NextResponse.json({ error: '取り込みに失敗しました' }, { status: 500 })
  }
}
