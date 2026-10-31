import { NextResponse } from 'next/server'
import { uploadPdfToDrive } from '@/lib/google'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROOT_FOLDER = 'Salud 請求書・見積書'

// 請求書/見積書PDFを1件ずつ Drive の「Salud 請求書・見積書/YYYY年M月」へ保存する
export async function POST(req: Request) {
  const { data: { user } } = await createServerSupabaseClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json() as { month?: string; fileName?: string; pdfBase64?: string }
  if (!body.month || !body.fileName || !body.pdfBase64) {
    return NextResponse.json({ error: 'month, fileName, pdfBase64 required' }, { status: 400 })
  }
  const fileName = body.fileName.replace(/[\/:*?"<>|]/g, '_')
  try {
    const file = await uploadPdfToDrive(
      user.id, [ROOT_FOLDER, body.month], fileName, Buffer.from(body.pdfBase64, 'base64'),
    )
    return NextResponse.json({ ok: true, ...file })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'NOT_CONNECTED') return NextResponse.json({ error: 'not_connected' }, { status: 409 })
    if (/ 403/.test(msg) || /insufficient/i.test(msg)) return NextResponse.json({ error: 'reauth_required' }, { status: 403 })
    console.error('invoice drive upload failed', e)
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
  }
}
