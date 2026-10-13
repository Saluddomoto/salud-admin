import { NextResponse } from 'next/server'
import { linePush } from '@salud/line'
import { createAdminClient } from '@/lib/supabase-admin'
import { COLUMN_SUBSIDIES } from '@/lib/column/subsidies'
import { generateColumn } from '@salud/ai'
import { createDraftPost, fetchColumnTitles } from '@/lib/column/wordpress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
// salud-web.jp が海外IPからのアクセスを拒否している場合があるため、実行場所を東京にする
export const preferredRegion = 'hnd1'

// 毎晩 21:00 JST に、補助金コラムを1本AIで書き、salud-web.jp に「下書き」で保存する。
// 公開はしない（人が確認してから公開）。保存できたらメンバーにLINEで通知する。
// 起動は Supabase pg_cron（他の cron と同じ方式）。
export async function GET(req: Request) {
  const cronSecret  = process.env.CRON_SECRET
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY || !process.env.WP_USER || !process.env.WP_APP_PASSWORD) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY / WP_USER / WP_APP_PASSWORD が未設定です' }, { status: 503 })
  }

  const admin = createAdminClient()
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

  // 直近の下書きが少ない補助金を優先して、偏りを防ぐ
  const { data: recent } = await admin
    .from('column_drafts')
    .select('subsidy')
    .gte('created_at', new Date(Date.now() - 14 * 86400_000).toISOString())
  const counts = new Map<string, number>()
  for (const r of recent ?? []) counts.set(r.subsidy, (counts.get(r.subsidy) ?? 0) + 1)
  const subsidy = [...COLUMN_SUBSIDIES].sort((a, b) => (counts.get(a.key) ?? 0) - (counts.get(b.key) ?? 0))[0]!

  try {
    const [wpTitles, { data: history }] = await Promise.all([
      fetchColumnTitles(),
      admin.from('column_drafts').select('title'),
    ])
    const existingTitles = [...new Set([...wpTitles, ...(history ?? []).map(h => h.title)])]

    const article = await generateColumn({ subsidy, existingTitles, today })
    const post = await createDraftPost({
      title: article.title,
      slug: article.slug,
      excerpt: article.metaDescription,
      html: article.html,
    })

    const { error: insertError } = await admin.from('column_drafts').insert({
      subsidy: subsidy.key,
      title: article.title,
      wp_post_id: post.id,
      unsure: article.unsure,
    })
    if (insertError) console.error('column-draft: history insert failed', insertError)

    // 通知（ダイジェストと同じ宛先）
    let sent = 0
    if (accessToken) {
      const { data: members } = await admin
        .from('profiles')
        .select('line_user_id')
        .not('line_user_id', 'is', null).eq('is_active', true).eq('digest_enabled', true)
      const lines = [
        '📝 コラムの下書きができました',
        `【${subsidy.name}】`,
        article.title,
        '',
        article.unsure.length
          ? `⚠ 要確認 ${article.unsure.length}点\n${article.unsure.slice(0, 5).map(u => `・${u}`).join('\n')}`
          : '要確認の点: なし（公開前に内容をご確認ください）',
        '',
        `編集・確認: ${post.editUrl}`,
      ]
      for (const m of members ?? []) {
        await linePush(m.line_user_id!, [{ type: 'text', text: lines.join('\n') }], accessToken)
          .then(() => { sent += 1 })
          .catch(e => console.error('column-draft: line push failed', e))
      }
    }

    return NextResponse.json({ ok: true, subsidy: subsidy.key, title: article.title, wpPostId: post.id, unsure: article.unsure.length, notified: sent })
  } catch (e) {
    console.error('column-draft: failed', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
