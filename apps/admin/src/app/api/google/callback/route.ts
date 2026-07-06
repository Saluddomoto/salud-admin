import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCode } from '@/lib/google'
import { createAdminClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Google OAuth コールバック — refresh token を保存して設定画面へ戻す
export async function GET(req: Request) {
  const url = new URL(req.url)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin
  const fail = (reason: string) =>
    NextResponse.redirect(`${appUrl}/settings?google=error&reason=${encodeURIComponent(reason)}`)

  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code) return fail(url.searchParams.get('error') ?? 'no_code')
  if (!state || state !== cookies().get('g_oauth_state')?.value) return fail('state_mismatch')

  const { data: { user } } = await createServerSupabaseClient().auth.getUser()
  if (!user) return fail('not_signed_in')

  try {
    const tokens = await exchangeCode(code)
    if (!tokens.refresh_token) return fail('no_refresh_token')

    const { error } = await createAdminClient()
      .from('google_calendar_connections')
      .upsert({ user_id: user.id, refresh_token: tokens.refresh_token }, { onConflict: 'user_id' })
    if (error) throw error

    return NextResponse.redirect(`${appUrl}/settings?google=connected`)
  } catch (e) {
    console.error('google callback failed', e)
    return fail('exchange_failed')
  }
}
