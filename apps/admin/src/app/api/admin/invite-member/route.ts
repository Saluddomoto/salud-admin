import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// ランダムな一時パスワードを生成（招待した管理者が本人に伝える）
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'admin 権限が必要です' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const email     = typeof body?.email === 'string' ? body.email.trim() : ''
  const full_name = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  const role      = ['admin', 'manager', 'staff'].includes(body?.role) ? body.role : 'staff'
  const department = typeof body?.department === 'string' ? body.department.trim() || null : null

  if (!email || !full_name) {
    return NextResponse.json({ error: 'メールアドレスと氏名は必須です' }, { status: 400 })
  }

  const tempPassword = generateTempPassword()
  const admin = createAdminClient()
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name, role },
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (department) {
    await admin.from('profiles').update({ department }).eq('id', created.user.id)
  }

  return NextResponse.json({ ok: true, email, tempPassword })
}
