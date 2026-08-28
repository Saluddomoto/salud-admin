import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { summarizeAnnualReports, type AnnualReportPerson } from '@salud/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FIELD_LABELS = [
  '今月の活動',
  '営業',
  '年間目標に対する今月の進捗',
  '現在の課題',
  '議論したいこと',
  '来月の取り組み・成果',
  '必要なサポート',
] as const

function mergedText(a: string | null, b: string | null): string {
  return [a, b].filter(Boolean).join('\n')
}

type ReportRow = {
  user_id: string
  period: string
  actions: string | null
  sales: string | null
  initiatives: string | null
  goal_progress: string | null
  challenges: string | null
  discussion_topics: string | null
  next_month_actions: string | null
  next_month_outcome: string | null
  support_needed: string | null
  profiles: { full_name: string } | null
}

// 1年分（1〜12月×役員全員）の月報をまとめてAI(Claude)に渡し、年間の振り返り
// （総括・年間の主な成果・年間を通じた課題・来年に向けた議論テーマ・提言）を生成する。
// DBへは書き込まない（都度その場で生成、結果は annual_report_ai_summaries に保存）。
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 503 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('is_executive, role').eq('id', user.id).single()
  if (!me || (me.is_executive !== true && me.role !== 'admin')) {
    return NextResponse.json({ error: '役員のみ利用できます' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as { year?: number } | null
  const year = body?.year
  if (!year || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'year が必要です' }, { status: 400 })
  }

  const admin = createAdminClient()
  const [reportsRes, prepRes] = await Promise.all([
    admin
      .from('monthly_reports')
      .select(
        'user_id, period, actions, sales, initiatives, goal_progress, challenges, discussion_topics, next_month_actions, next_month_outcome, support_needed, profiles(full_name)',
      )
      .gte('period', `${year}-01-01`)
      .lte('period', `${year}-12-01`)
      .order('period', { ascending: true }),
    admin.from('board_prep_sheets').select('user_id, this_year_contribution'),
  ])
  if (reportsRes.error || prepRes.error) {
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
  }

  const reports = (reportsRes.data ?? []) as unknown as ReportRow[]
  const prepSheets = (prepRes.data ?? []) as { user_id: string; this_year_contribution: string | null }[]

  if (reports.length === 0) {
    return NextResponse.json({ error: `${year}年の月報がまだありません` }, { status: 400 })
  }

  const byUser = new Map<string, ReportRow[]>()
  for (const r of reports) {
    const list = byUser.get(r.user_id) ?? []
    list.push(r)
    byUser.set(r.user_id, list)
  }

  const people: AnnualReportPerson[] = Array.from(byUser.entries()).map(([userId, rows]) => {
    const goal = prepSheets.find(p => p.user_id === userId)?.this_year_contribution ?? null
    return {
      fullName: rows[0]?.profiles?.full_name ?? '(不明)',
      goal,
      months: rows.map(r => ({
        period: r.period,
        sections: [
          { label: FIELD_LABELS[0], value: mergedText(r.actions, r.initiatives) },
          { label: FIELD_LABELS[1], value: r.sales ?? '' },
          { label: FIELD_LABELS[2], value: r.goal_progress ?? '' },
          { label: FIELD_LABELS[3], value: r.challenges ?? '' },
          { label: FIELD_LABELS[4], value: r.discussion_topics ?? '' },
          { label: FIELD_LABELS[5], value: mergedText(r.next_month_actions, r.next_month_outcome) },
          { label: FIELD_LABELS[6], value: r.support_needed ?? '' },
        ],
      })),
    }
  })

  let summary
  try {
    summary = await summarizeAnnualReports(year, people)
  } catch (e) {
    console.error('年間AI分析に失敗', e)
    const message = e instanceof Error ? e.message : 'AI分析に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { data: saved, error: saveError } = await admin
    .from('annual_report_ai_summaries')
    .upsert(
      {
        year,
        overview: summary.overview,
        highlights: summary.highlights,
        risks: summary.risks,
        discussion_agenda: summary.discussionAgenda,
        advice: summary.advice,
        generated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'year' },
    )
    .select('updated_at')
    .single()
  if (saveError) {
    console.error('年間AI分析結果の保存に失敗', saveError)
  }

  return NextResponse.json({ ...summary, updatedAt: saved?.updated_at ?? null })
}
