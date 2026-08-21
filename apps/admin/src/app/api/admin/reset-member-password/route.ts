import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { generateTempPassword } from '@/lib/tempPassword'

// 管理者が他メンバーのパスワードを強制リセットする（本人がパスワードを忘れた場合など）。
// 発行した一時パスワードは呼び出し元にこの1回だけ返す — 本人には管理者から直接伝えてもらい、
// 受け取ったら /settings > セキュリティ で自分の好きなパスワードに変更してもらう想定。
export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'admin 権限が必要です' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const memberId = typeof body?.id === 'string' ? body.id : ''
  if (!memberId) {
    return NextResponse.json({ error: 'メンバーIDが指定されていません' }, { status: 400 })
  }

  const tempPassword = generateTempPassword()
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(memberId, { password: tempPassword })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, tempPassword })
}
