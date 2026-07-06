import { NextResponse } from 'next/server'
import { googleAuthUrl } from '@/lib/google'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Google OAuth 開始（設定画面の「接続する」から遷移）
export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: 'Google 環境変数が未設定です' }, { status: 503 })
  }
  const state = crypto.randomUUID()
  const res = NextResponse.redirect(googleAuthUrl(state))
  res.cookies.set('g_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' })
  return res
}
