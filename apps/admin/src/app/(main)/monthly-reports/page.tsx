'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchMyProfile, fetchExecutiveProfiles, fetchMonthlyReports, upsertMonthlyReport, fetchTasks,
  fetchBoardPrepSheets, upsertBoardPrepSheet,
  type DbProfile, type DbMonthlyReport, type MonthlyReportInput, type DbTask,
  type DbBoardPrepSheet, type BoardPrepSheetInput,
} from '@/lib/db'

const PREP_FIELDS: { key: keyof BoardPrepSheetInput; label: string; hint: string }[] = [
  {
    key: 'ideal_future',
    label: '① 2年後のSaludの理想像',
    hint: '2年後、Saludはどんな会社になっていてほしいですか？ どんな組織になっていたら「良い会社」だと思いますか？',
  },
  {
    key: 'why_involved',
    label: '② なぜSaludと関わるのか',
    hint: 'Saludを通じて実現したいことは何ですか？ 今後どのような形で関わっていきたいですか？ Saludに期待することは何ですか？',
  },
  {
    key: 'this_year_contribution',
    label: '③ 今年、自分がSaludにもたらしたいこと',
    hint: '今年どのような貢献をしたいですか？ どんなことをやりたい（挑戦したい）ですか？ どのような成果を目指したいですか？ そのために具体的にどのような行動をしますか？',
  },
  {
    key: 'year_end_reflection',
    label: '最後に',
    hint: '2026年12月31日、今年を振り返った時、「Saludに関わって良かった」と思える状態はどんな状態ですか？',
  },
]

const EMPTY_PREP_INPUT: BoardPrepSheetInput = {
  ideal_future: '', why_involved: '', this_year_contribution: '', year_end_reflection: '',
}

type ReportField = { key: keyof MonthlyReportInput; label: string; question: string; hint: string; example: string }

// 【A】今月の振り返り
const REVIEW_FIELDS: ReportField[] = [
  {
    key: 'actions',
    label: '① 行動',
    question: '今月、主体的に動いたこと・意思決定したことは？',
    hint: '自分で考え、行動したことを振り返ります。',
    example: '例）スタッフの案件対応の進め方を整理した／新規顧客への提案方法を変更した',
  },
  {
    key: 'sales',
    label: '② 営業',
    question: '今月の営業・商談・新規開拓の動きは？',
    hint: '売上につながる活動の進捗を確認します。',
    example: '例）新規商談5件／代理店候補3社と商談／士業からの紹介案件2件',
  },
  {
    key: 'initiatives',
    label: '③ 取り組んだこと',
    question: '今月、新しく始めたこと・改善したこと・学んだことは？',
    hint: '将来のSaludにつながる改善や成長を振り返ります。',
    example: '例）LINE問い合わせ対応マニュアルを整備した／新しい補助金情報のキャッチアップ会を月1で開始した',
  },
]

// 【B】目標への進捗
const GOAL_FIELDS: ReportField[] = [
  {
    key: 'goal_progress',
    label: '⑤ 年間目標に対する今月の進捗',
    question: '今年の目標に対して、今月進んだこと・進まなかったことは？',
    hint: '今年の目標に対して、どこまで近づけたかを確認します。',
    example: '例）持続化補助金の業務フローを整理し、標準化に着手できた／AIによる計画書作成支援はまだ検証段階',
  },
  {
    key: 'challenges',
    label: '⑥ 現在の課題',
    question: '目標達成に向けて、現在感じている課題は？',
    hint: '目標達成を妨げている原因や、会社として解決すべき課題を整理します。',
    example: '例）自分が業務を抱えすぎている／業務フローが標準化されていない',
  },
]

// 【C】月末会議
const MEETING_FIELDS: ReportField[] = [
  {
    key: 'discussion_topics',
    label: '⑦ 議論したいこと',
    question: '月末の場で、みんなに相談・議論したいことは？',
    hint: 'みんなの意見を聞きたいこと、会社として意思決定したいことを書いてください。',
    example: '例）持続化補助金をAI中心のサービスに変えるべきか／代理店制度の次のステップをどうするか',
  },
]

// 【D】来月の計画
const NEXT_FIELDS: ReportField[] = [
  {
    key: 'next_month_actions',
    label: '⑧ 来月取り組むこと',
    question: '来月、取り組むこと・改善することは？',
    hint: '今月の振り返りを、来月の具体的な行動につなげます。',
    example: '例）持続化補助金の業務フローを完成させる／新サービス候補3社にヒアリングする',
  },
  {
    key: 'next_month_outcome',
    label: '⑨ 来月の成果',
    question: '来月、どういう状態になっていたら「進んだ」と言える？',
    hint: '何をするかではなく、来月の終わりにどうなっていたいかを考えます。',
    example: '例）持続化補助金を他のメンバーでも対応できる状態にする',
  },
  {
    key: 'support_needed',
    label: '⑩ 必要なサポート',
    question: '目標達成のために、会社・役員・メンバーに協力してほしいことは？',
    hint: '個人ではなく、組織で成果を出すために必要な協力を明確にします。',
    example: '例）三戸部さんに◯◯業務を引き継げるようマニュアル化を手伝ってほしい',
  },
]

// タスクだけは専用UI（完了タスク読み込みボタン付き）で別枠に表示するため、他ブロックとフィールド定義を分ける
const TASKS_FIELD: ReportField = {
  key: 'tasks',
  label: '④ タスク',
  question: 'この月に完了した主なタスク',
  hint: 'タスク管理の完了タスクを箇条書きで読み込めます。月報の中心ではなく補助情報として扱います。',
  example: '例）・A社 持続化補助金の申請書を提出\n・B社 見積書を送付',
}

const REPORT_BLOCKS: { heading: string; description?: string; fields: ReportField[] }[] = [
  { heading: '今月の振り返り', fields: [...REVIEW_FIELDS, TASKS_FIELD] },
  { heading: '目標への進捗', description: '今年の目標に対して、今月どこまで進んだかを振り返ります。', fields: GOAL_FIELDS },
  { heading: '月末会議', description: '月末の発表・議論で扱いたいテーマを整理します。', fields: MEETING_FIELDS },
  { heading: '来月の計画', fields: NEXT_FIELDS },
]

const EMPTY_INPUT: MonthlyReportInput = {
  actions: '', sales: '', tasks: '', initiatives: '',
  goal_progress: '', challenges: '', discussion_topics: '',
  next_month_actions: '', next_month_outcome: '', support_needed: '',
}

function reportToInput(report: DbMonthlyReport): MonthlyReportInput {
  return {
    actions: report.actions ?? '',
    sales: report.sales ?? '',
    tasks: report.tasks ?? '',
    initiatives: report.initiatives ?? '',
    goal_progress: report.goal_progress ?? '',
    challenges: report.challenges ?? '',
    discussion_topics: report.discussion_topics ?? '',
    next_month_actions: report.next_month_actions ?? '',
    next_month_outcome: report.next_month_outcome ?? '',
    support_needed: report.support_needed ?? '',
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

function jstNow() {
  const d = new Date(Date.now() + 9 * 3600_000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }
}

export default function MonthlyReportsPage() {
  const { role, isLoading: authLoading } = useAuth()
  const [{ y, m }, setYm] = useState(jstNow)

  const [me,        setMe]        = useState<DbProfile | null>(null)
  const [meLoading, setMeLoading] = useState(true)
  const [execs,     setExecs]     = useState<DbProfile[]>([])
  const [reports,   setReports]   = useState<DbMonthlyReport[]>([])
  const [myTasks,   setMyTasks]   = useState<DbTask[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState(false)
  const [form,      setForm]      = useState<MonthlyReportInput>(EMPTY_INPUT)
  const [saving,    setSaving]    = useState(false)

  // 役員会議 事前シート（月次ではなく1人1件・随時更新）
  const [prepSheets,  setPrepSheets]  = useState<DbBoardPrepSheet[]>([])
  const [prepLoading, setPrepLoading] = useState(true)
  const [prepEditing, setPrepEditing] = useState(false)
  const [prepForm,    setPrepForm]    = useState<BoardPrepSheetInput>(EMPTY_PREP_INPUT)
  const [prepSaving,  setPrepSaving]  = useState(false)

  const period = useMemo(() => `${y}-${pad(m)}-01`, [y, m])
  const periodEnd = useMemo(() => {
    const total = y * 12 + (m - 1) + 1
    return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`
  }, [y, m])

  useEffect(() => {
    fetchMyProfile().then(setMe).finally(() => setMeLoading(false))
    fetchTasks().then(setMyTasks).catch(() => {})
  }, [])

  // この月に完了(done)したタスクを箇条書きにして「タスク」欄に読み込むためのボタン用
  const completedTaskBullets = useMemo(() => {
    if (!me) return []
    return myTasks
      .filter(t => t.status === 'done' && t.assigned_user_id === me.id)
      .filter(t => t.updated_at >= period && t.updated_at < periodEnd)
      .map(t => `・${t.title}`)
  }, [myTasks, me, period, periodEnd])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([fetchExecutiveProfiles(), fetchMonthlyReports(period)])
      .then(([e, r]) => { setExecs(e); setReports(r) })
      .catch(() => { setExecs([]); setReports([]) })
      .finally(() => setLoading(false))
  }, [period])

  useEffect(load, [load])

  const isExecutive = me?.is_executive === true
  const canAccess = isExecutive

  const myReport = useMemo(
    () => (me ? reports.find(r => r.user_id === me.id) ?? null : null),
    [reports, me]
  )

  useEffect(() => {
    setForm(myReport ? reportToInput(myReport) : EMPTY_INPUT)
    setEditing(false)
  }, [myReport])

  const shiftMonth = (delta: number) => {
    setYm(prev => {
      const total = (prev.y * 12 + (prev.m - 1)) + delta
      return { y: Math.floor(total / 12), m: (total % 12) + 1 }
    })
  }

  const isCurrentMonth = useMemo(() => {
    const now = jstNow()
    return now.y === y && now.m === m
  }, [y, m])

  const handleSave = async () => {
    setSaving(true)
    try {
      await upsertMonthlyReport(period, form)
      setEditing(false)
      load()
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  // 事前シートは月に紐づかないので、タブを開いたときに一度だけ読み込む
  const loadPrep = useCallback(() => {
    setPrepLoading(true)
    fetchBoardPrepSheets()
      .then(setPrepSheets)
      .catch(() => setPrepSheets([]))
      .finally(() => setPrepLoading(false))
  }, [])

  useEffect(loadPrep, [loadPrep])

  const myPrepSheet = useMemo(
    () => (me ? prepSheets.find(s => s.user_id === me.id) ?? null : null),
    [prepSheets, me]
  )

  useEffect(() => {
    setPrepForm(myPrepSheet
      ? {
          ideal_future: myPrepSheet.ideal_future ?? '',
          why_involved: myPrepSheet.why_involved ?? '',
          this_year_contribution: myPrepSheet.this_year_contribution ?? '',
          year_end_reflection: myPrepSheet.year_end_reflection ?? '',
        }
      : EMPTY_PREP_INPUT)
    setPrepEditing(false)
  }, [myPrepSheet])

  const handleSavePrep = async () => {
    setPrepSaving(true)
    try {
      await upsertBoardPrepSheet(prepForm)
      setPrepEditing(false)
      loadPrep()
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setPrepSaving(false)
    }
  }

  const others = execs.filter(e => e.id !== me?.id)

  if (!authLoading && !meLoading && !canAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900">役員月報は役員メンバーのみ利用できます</h2>
        <p className="text-sm text-slate-500">このページを表示する権限がありません。</p>
        <a href="/" className="mt-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          ダッシュボードに戻る
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="役員月報" description="役員メンバーの月次活動報告・役員会議の事前シート（相互閲覧）" />

      {/* 役員会議 事前シートセクション */}
      <h2 className="text-sm font-bold text-slate-800">役員会議 事前シート</h2>

      {/* 自分の事前シート */}
      {isExecutive && me && (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {me.full_name?.[0] ?? '?'}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{me.full_name}（あなた）</p>
                {myPrepSheet && !prepEditing && (
                  <p className="text-xs text-slate-400">
                    最終更新: {new Date(myPrepSheet.updated_at).toLocaleString('ja-JP')}
                  </p>
                )}
              </div>
            </div>
            {!prepEditing && (
              <button className="btn-secondary text-sm" onClick={() => setPrepEditing(true)}>
                {myPrepSheet ? '編集' : '事前シートを書く'}
              </button>
            )}
          </div>

          {prepEditing ? (
            <div className="space-y-4">
              {PREP_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{f.label}</label>
                  <p className="mb-1.5 text-xs text-slate-400">{f.hint}</p>
                  <textarea
                    className="input min-h-[120px] resize-y"
                    value={prepForm[f.key]}
                    onChange={e => setPrepForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => { setPrepEditing(false); setPrepForm(myPrepSheet
                    ? {
                        ideal_future: myPrepSheet.ideal_future ?? '',
                        why_involved: myPrepSheet.why_involved ?? '',
                        this_year_contribution: myPrepSheet.this_year_contribution ?? '',
                        year_end_reflection: myPrepSheet.year_end_reflection ?? '',
                      }
                    : EMPTY_PREP_INPUT) }}
                >
                  キャンセル
                </button>
                <button className="btn-primary text-sm" onClick={handleSavePrep} disabled={prepSaving}>
                  {prepSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : myPrepSheet ? (
            <PrepBody sheet={myPrepSheet} />
          ) : (
            <p className="text-sm text-slate-400">まだ事前シートが書かれていません。</p>
          )}
        </div>
      )}

      {/* 他の役員の事前シート */}
      {prepLoading ? (
        <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>
      ) : (
        <div className="space-y-4">
          {others.map(ex => {
            const s = prepSheets.find(sh => sh.user_id === ex.id) ?? null
            return (
              <div key={ex.id} className="card p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                      {ex.full_name?.[0] ?? '?'}
                    </span>
                    <p className="font-semibold text-slate-900">{ex.full_name}</p>
                  </div>
                  {s && (
                    <p className="text-xs text-slate-400">
                      更新: {new Date(s.updated_at).toLocaleDateString('ja-JP')}
                    </p>
                  )}
                </div>
                {s ? <PrepBody sheet={s} /> : (
                  <p className="text-sm text-slate-400">まだ事前シートが書かれていません。</p>
                )}
              </div>
            )
          })}
          {others.length === 0 && !isExecutive && (
            <p className="p-12 text-center text-sm text-slate-400">役員メンバーがいません</p>
          )}
        </div>
      )}

      {/* 月報セクション */}
      <div className="mt-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">月報</h2>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded-lg px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100"
            aria-label="前の月"
          >
            ‹
          </button>
          <span className="min-w-[6rem] text-center text-sm font-semibold text-slate-800">
            {y}年{m}月
          </span>
          <button
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            className="rounded-lg px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
            aria-label="次の月"
          >
            ›
          </button>
        </div>
      </div>

      {/* 自分の月報 */}
      {isExecutive && me && (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {me.full_name?.[0] ?? '?'}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{me.full_name}（あなた）</p>
              </div>
            </div>
            {!editing && (
              <button className="btn-secondary text-sm" onClick={() => setEditing(true)}>
                {myReport ? '編集' : 'この月の報告を書く'}
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-5">
              {REPORT_BLOCKS.map(block => (
                <div key={block.heading} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                  <h3 className="text-sm font-bold text-slate-800">{block.heading}</h3>
                  {block.description && (
                    <p className="mt-0.5 text-xs text-slate-400">{block.description}</p>
                  )}
                  {block.heading === '目標への進捗' && (
                    <div className="mb-4 mt-3">
                      <GoalPanel year={y} goal={myPrepSheet?.this_year_contribution ?? null} />
                    </div>
                  )}
                  <div className="mt-4 space-y-4">
                    {block.fields.map(f => (
                      <div key={f.key}>
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <label className="block text-sm font-semibold text-slate-800">{f.label}</label>
                          {f.key === 'tasks' && (
                            <button
                              type="button"
                              disabled={completedTaskBullets.length === 0}
                              className="text-xs font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                              onClick={() => {
                                const bullets = completedTaskBullets.join('\n')
                                setForm(prev => ({ ...prev, tasks: prev.tasks ? `${prev.tasks}\n${bullets}` : bullets }))
                              }}
                            >
                              {completedTaskBullets.length > 0
                                ? `完了タスクを読み込む（${completedTaskBullets.length}件）`
                                : 'この月に完了したタスクはありません'}
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">{f.question}</p>
                        <p className="mb-1.5 text-xs text-slate-400">{f.hint}</p>
                        <textarea
                          className="input min-h-[70px] resize-y"
                          placeholder={f.example}
                          value={form[f.key]}
                          onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => { setEditing(false); setForm(myReport ? reportToInput(myReport) : EMPTY_INPUT) }}
                >
                  キャンセル
                </button>
                <button className="btn-primary text-sm" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <GoalPanel year={y} goal={myPrepSheet?.this_year_contribution ?? null} />
              {myReport ? (
                <ReportBody report={myReport} />
              ) : (
                <p className="text-sm text-slate-400">この月の報告はまだありません。</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 他の役員の月報 */}
      {loading ? (
        <p className="p-12 text-center text-sm text-slate-400">読み込み中...</p>
      ) : (
        <div className="space-y-4">
          {others.map(ex => {
            const r = reports.find(rep => rep.user_id === ex.id) ?? null
            const exPrep = prepSheets.find(sh => sh.user_id === ex.id) ?? null
            return (
              <div key={ex.id} className="card space-y-5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                      {ex.full_name?.[0] ?? '?'}
                    </span>
                    <p className="font-semibold text-slate-900">{ex.full_name}</p>
                  </div>
                </div>
                <GoalPanel year={y} goal={exPrep?.this_year_contribution ?? null} />
                {r ? <ReportBody report={r} /> : (
                  <p className="text-sm text-slate-400">この月の報告はまだありません。</p>
                )}
              </div>
            )
          })}
          {others.length === 0 && !isExecutive && (
            <p className="p-12 text-center text-sm text-slate-400">役員メンバーがいません</p>
          )}
        </div>
      )}
    </div>
  )
}

// 事前シート③（今年、自分がSaludにもたらしたいこと）を「年間目標」として表示するパネル。
// その月の月報がまだ書かれていなくても、目標は独立して常に見えるようにする
// （月報カードの有無に紐づけると、月報未記入者の目標だけ一緒に隠れてしまうため）。
function GoalPanel({ year, goal }: { year: number; goal: string | null }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <p className="mb-1 text-xs font-semibold text-slate-400">{year}年の目標（事前シート③より）</p>
      {goal ? (
        <p className="whitespace-pre-wrap text-sm text-slate-700">{goal}</p>
      ) : (
        <p className="text-sm text-slate-400">
          「役員会議 事前シート」の③（今年、自分がSaludにもたらしたいこと）が未記入です。
        </p>
      )}
    </div>
  )
}

function ReportBody({ report }: { report: DbMonthlyReport }) {
  return (
    <div className="space-y-5">
      {REPORT_BLOCKS.map(block => {
        const visibleFields = block.fields.filter(f => report[f.key])
        if (visibleFields.length === 0) return null
        return (
          <div key={block.heading}>
            <p className="mb-2 text-xs font-bold text-slate-400">{block.heading}</p>
            <div className="space-y-3">
              {visibleFields.map(f => (
                <div key={f.key}>
                  <p className="mb-1 text-xs font-semibold text-slate-400">{f.label}</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{report[f.key]}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PrepBody({ sheet }: { sheet: DbBoardPrepSheet }) {
  return (
    <div className="space-y-3">
      {PREP_FIELDS.map(f => {
        const value = sheet[f.key]
        if (!value) return null
        return (
          <div key={f.key}>
            <p className="mb-1 text-xs font-semibold text-slate-400">{f.label}</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{value}</p>
          </div>
        )
      })}
    </div>
  )
}
