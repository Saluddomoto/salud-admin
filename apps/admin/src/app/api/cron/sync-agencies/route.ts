import { NextResponse } from 'next/server'
import { parseCsv } from '@/lib/csv'
import { createAdminClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 代理店募集フォームの回答が溜まるスプレッドシート（共有設定＝リンクを知っている全員が閲覧可）
const FORM_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1cfKMOk3NcEdfycAM-m6h6hZj95J661C_awPTlj91t50/export?format=csv'

// CSV列インデックス → partner_agencies のカラム（フォームの質問順に対応、列23「列 22」は未使用のため取り込まない）
const COLUMN_MAP: Array<[number, string]> = [
  [1, 'company_name'],
  [2, 'contact_person'],
  [3, 'email'],
  [4, 'phone'],
  [5, 'hp_url'],
  [6, 'business_description'],
  [7, 'customer_count'],
  [8, 'sales_staff_count'],
  [9, 'customer_industries'],
  [10, 'customer_regions'],
  [11, 'desired_collaboration'],
  [12, 'desired_support'],
  [13, 'seminar_cooperation'],
  [14, 'seminar_reachable_count'],
  [15, 'annual_referral_estimate'],
  [16, 'has_current_prospects'],
  [17, 'target_customer_profile'],
  [18, 'meeting_notes'],
  [21, 'info_delivery_method'],
  [22, 'address'],
]

// 代理店募集フォームの回答スプレッドシートをCSVで取得し、未取込の行だけ partner_agencies に追加する。
// タイムスタンプ列を突合キーとし、既に取り込み済みの回答は何度実行してもスキップされる。
async function runSync() {
  const res = await fetch(FORM_SHEET_CSV_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`sheet fetch failed: ${res.status}`)
  const text = await res.text()
  const rows = parseCsv(text).filter(r => r.length > 1)
  const dataRows = rows.slice(1) // 先頭行はヘッダー

  const admin = createAdminClient()
  const { data: existing, error: existingError } = await admin
    .from('partner_agencies')
    .select('form_timestamp')
    .eq('source', 'form')
    .not('form_timestamp', 'is', null)
  if (existingError) throw existingError
  const known = new Set((existing ?? []).map(r => r.form_timestamp))

  const toInsert = dataRows
    .filter(r => r[0] && !known.has(r[0]))
    .map(r => {
      const record: Record<string, string | null> = { source: 'form', form_timestamp: r[0] ?? null }
      for (const [colIndex, column] of COLUMN_MAP) {
        record[column] = (r[colIndex] ?? '').trim() || null
      }
      if (!record.company_name) record.company_name = '(会社名未回答)'
      return record
    })

  if (toInsert.length === 0) return { imported: 0, total: dataRows.length }

  const { error: insertError } = await admin.from('partner_agencies').insert(toInsert)
  if (insertError) throw insertError

  return { imported: toInsert.length, total: dataRows.length }
}

// Supabase pg_cron から定期起動
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await runSync()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('sync-agencies: failed', e)
    return NextResponse.json({ error: 'sync failed' }, { status: 500 })
  }
}

// /agencies 画面の「今すぐ同期」ボタンから、ログイン中のユーザーが手動起動する
export async function POST() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const result = await runSync()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('sync-agencies: manual sync failed', e)
    return NextResponse.json({ error: 'sync failed' }, { status: 500 })
  }
}
