import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { summarizeMonthlyReports, type MonthlyReportPerson } from '@salud/ai'

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

// 複数役員分の月報をまとめてAI(Claude)に渡し、月末会議向けの横断分析（要約・好調な点・
// 共通課題・議論アジェンダ・アドバイス）を生成する。DBへは書き込まない（都度その場で生成）。
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 503 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 役員月報と同じ対象範囲に限定する（役員 or admin のみ）
  const { data: me } = await supabase.from('profiles').select('is_executive, role').eq('id', user.id).single()
  if (!me || (me.is_executive !== true && me.role !== 'admin')) {
    return NextResponse.json({ error: '役員のみ利用できます' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as { period?: string } | null
  const period = body?.period
  if (!period) return NextResponse.json({ error: 'period が必要です' }, { status: 400 })

  const admin = createAdminClient()
  const [reportsRes, prepRes] = await Promise.all([
    admin
      .from('monthly_reports')
      .select(
        'user_id, actions, sales, initiatives, goal_progress, challenges, discussion_topics, next_month_actions, next_month_outcome, support_needed, profiles(full_name)',
      )
      .eq('period', period),
    admin.from('board_prep_sheets').select('user_id, this_year_contribution'),
  ])
  if (reportsRes.error || prepRes.error) {
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
  }

  const reports = (reportsRes.data ?? []) as unknown as ReportRow[]
  const prepSheets = (prepRes.data ?? []) as { user_id: string; this_year_contribution: string | null }[]

  if (reports.length === 0) {
    return NextResponse.json({ error: 'この月の月報がまだありません' }, { status: 400 })
  }

  const people: MonthlyReportPerson[] = reports.map(r => {
    const goal = prepSheets.find(p => p.user_id === r.user_id)?.this_year_contribution ?? null
    return {
      fullName: r.profiles?.full_name ?? '(不明)',
      goal,
      sections: [
        { label: FIELD_LABELS[0], value: mergedText(r.actions, r.initiatives) },
        { label: FIELD_LABELS[1], value: r.sales ?? '' },
        { label: FIELD_LABELS[2], value: r.goal_progress ?? '' },
        { label: FIELD_LABELS[3], value: r.challenges ?? '' },
        { label: FIELD_LABELS[4], value: r.discussion_topics ?? '' },
        { label: FIELD_LABELS[5], value: mergedText(r.next_month_actions, r.next_month_outcome) },
        { label: FIELD_LABELS[6], value: r.support_needed ?? '' },
      ],
    }
  })

  try {
    const summary = await summarizeMonthlyReports(period, people)
    return NextResponse.json(summary)
  } catch (e) {
    console.error('月報AI分析に失敗', e)
    return NextResponse.json({ error: 'AI分析に失敗しました' }, { status: 500 })
  }
}
