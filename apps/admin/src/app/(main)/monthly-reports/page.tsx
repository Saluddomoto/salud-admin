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
import type { MonthlyReportSummary } from '@salud/ai'

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
    label: '① 今月の活動',
    question: '今月、主体的に取り組んだこと・改善したことは？',
    hint: '日々の業務だけでなく、自分で考えて動いたこと、新しく挑戦したこと、業務の改善や学びなど、今月の主な活動を振り返ります（旧「取り組んだこと」欄はここに統合されました）。',
    example: '・代理店候補と商談し、契約まで進めた\n・補助金案件の進め方を整理した\n・Webサイトの不具合を発見し、復旧対応した\n・業務フローを見直し、○○の作業を効率化した\n・LINE問い合わせ対応マニュアルを整備した',
  },
  {
    key: 'sales',
    label: '② 営業',
    question: '今月、売上・顧客・案件につながる活動は？',
    hint: '商談・紹介・提案・契約・既存顧客へのフォローなど、売上や顧客獲得につながる活動を振り返ります。可能であれば件数・金額・契約状況など数字を入れてください。',
    example: '・新規商談3件\n・代理店候補5社へ提案\n・既存顧客へ追加提案\n・紹介から1件契約\n・士業との連携を1件開始',
  },
]

// 【B】目標への進捗
const GOAL_FIELDS: ReportField[] = [
  {
    key: 'goal_progress',
    label: '③ 年間目標に対する今月の進捗',
    question: '今年の目標に対して、今月進んだこと・進まなかったことは？',
    hint: '今年の目標に対して、どこまで近づけたかを振り返ります。「何をやったか」だけでなく「年間目標にどうつながったか」を書きます。',
    example: '【進んだこと】\n・代理店契約を1社獲得し、代理店拡大に一歩進んだ\n・持続化補助金の業務フロー整理に着手した\n\n【進まなかったこと】\n・新サービスの顧客ヒアリングまで進められなかった\n・AI活用の検証が止まっている',
  },
  {
    key: 'challenges',
    label: '④ 現在の課題',
    question: '目標達成に向けて、現在感じている課題は？',
    hint: '目標達成を妨げている原因や、会社として解決すべき課題を整理します。「忙しい」で終わらせず、何がボトルネックなのかまで考えます。',
    example: '・業務が一部のメンバーに属人化している\n・自分が細かい業務まで抱えてしまっている\n・新規サービスの方向性がまだ決まっていない\n・役員間で情報共有する機会が少ない\n・営業活動に時間を十分に使えていない',
  },
]

// 【C】月末会議
const MEETING_FIELDS: ReportField[] = [
  {
    key: 'discussion_topics',
    label: '⑤ 議論したいこと',
    question: '月末の場で、みんなに相談・議論したいことは？',
    hint: 'みんなの意見を聞きたいこと、会社として意思決定したいことを書いてください。「相談があります」ではなく、何について意見が欲しいのか具体的に。月末会議のアジェンダとして使います。',
    example: '・持続化補助金をAI中心のサービスに変えていくべきか\n・代理店制度の次のステップをどうするか\n・新しいストックサービスをどう設計するか\n・業務を誰にどこまで任せるか\n・新サービスの価格設定をどうするか',
  },
]

// 【D】来月の計画
// 「⑥ 来月の取り組み・成果」は旧「来月取り組むこと」(next_month_actions)と旧「来月の成果」(next_month_outcome)を
// 統合した項目。行動と成果を別々の欄に分けず、1つの自然な文章で「何をして、どうなりたいか」を書いてもらう。
const NEXT_FIELDS: ReportField[] = [
  {
    key: 'next_month_actions',
    label: '⑥ 来月の取り組み・成果',
    question: '来月、何に取り組み、どんな状態を目指す？',
    hint: '今月の振り返りを踏まえて、来月やることと、その結果どうなっていたいかを1つの文章で整理します。',
    example: '・代理店候補5社に提案し、1社以上の契約につなげる\n・持続化補助金の業務フローを整理し、他のメンバーでも対応できる状態にする\n・新サービスの顧客ヒアリングを3社実施し、サービス内容を固める',
  },
  {
    key: 'support_needed',
    label: '⑦ 必要なサポート',
    question: '目標達成のために、会社・役員・メンバーに協力してほしいことは？',
    hint: '個人ではなく、組織で成果を出すために必要な協力を明確にします。誰に、何を協力してほしいのかまで具体的に書きます。',
    example: '・栗原さんに補助金業務の標準化について相談したい\n・堂本さんに新サービスの方向性について意思決定してほしい\n・○○さんにWeb制作部分をお願いしたい\n・営業資料の作成をサポートしてほしい',
  },
]

// タスクだけは専用UI（完了タスク読み込みボタン付き）で別枠に表示するため、他ブロックとフィールド定義を分ける
const TASKS_FIELD: ReportField = {
  key: 'tasks',
  label: 'タスク',
  question: 'この月に完了した主なタスク',
  hint: 'タスク管理の完了タスクを箇条書きで読み込めます。月報の中心ではなく補助情報として扱います。',
  example: '・A社 持続化補助金の申請書を提出\n・B社 見積書を送付',
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

// 「① 今月の活動」欄は旧「行動」(actions)と旧「取り組んだこと」(initiatives)を統合した項目。
// 「⑥ 来月の取り組み・成果」欄は旧「来月取り組むこと」(next_month_actions)と
// 旧「来月の成果」(next_month_outcome)を統合した項目。
// どちらも、別カラムのまま残っている過去データを失わないよう、表示・編集どちらも両方の内容を合体して扱う。
// 保存すると自然に前者のカラムへ一本化され、後者は空になる（DBスキーマは変更しない）。
function mergedActions(report: Pick<DbMonthlyReport, 'actions' | 'initiatives'>): string {
  return [report.actions, report.initiatives].filter(Boolean).join('\n')
}

function mergedNextMonth(report: Pick<DbMonthlyReport, 'next_month_actions' | 'next_month_outcome'>): string {
  return [report.next_month_actions, report.next_month_outcome].filter(Boolean).join('\n')
}

function reportToInput(report: DbMonthlyReport): MonthlyReportInput {
  return {
    actions: mergedActions(report),
    sales: report.sales ?? '',
    tasks: report.tasks ?? '',
    initiatives: '',
    goal_progress: report.goal_progress ?? '',
    challenges: report.challenges ?? '',
    discussion_topics: report.discussion_topics ?? '',
    next_month_actions: mergedNextMonth(report),
    next_month_outcome: '',
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

  // 月報のAI横断分析（クリックしたときだけ実行。DBには保存せずその場で表示するだけ）
  const [aiSummary, setAiSummary] = useState<MonthlyReportSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError,   setAiError]   = useState<string | null>(null)

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
    // 月を切り替えたら、前の月のAI分析結果を出しっぱなしにしない
    setAiSummary(null)
    setAiError(null)
  }

  const handleRunAi = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/monthly-reports/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI分析に失敗しました')
      setAiSummary(data as MonthlyReportSummary)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiLoading(false)
    }
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

  // 月報の「目標への進捗」からも、事前シート③（今年の目標）だけを軽く編集できるようにする
  // （他の3項目のために事前シートの編集フォームを開かせずに済む）。保存先は事前シートと同じ。
  const [goalEditing, setGoalEditing] = useState(false)
  const [goalDraft,   setGoalDraft]   = useState('')
  const [goalSaving,  setGoalSaving]  = useState(false)

  const startGoalEdit = () => {
    setGoalDraft(myPrepSheet?.this_year_contribution ?? '')
    setGoalEditing(true)
  }

  const handleSaveGoal = async () => {
    setGoalSaving(true)
    try {
      await upsertBoardPrepSheet({
        ideal_future: myPrepSheet?.ideal_future ?? '',
        why_involved: myPrepSheet?.why_involved ?? '',
        this_year_contribution: goalDraft,
        year_end_reflection: myPrepSheet?.year_end_reflection ?? '',
      })
      setGoalEditing(false)
      loadPrep()
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setGoalSaving(false)
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

      {/* AI横断分析（クリックしたときだけ、3人分の月報をまとめてAIに分析させる） */}
      {isExecutive && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">AI分析</p>
              <p className="text-xs text-slate-400">
                {y}年{m}月の役員月報をまとめてAIに読ませ、全体の要約・好調な点・共通の課題・
                月末会議のアジェンダ・アドバイスを生成します。
              </p>
            </div>
            <button className="btn-primary text-sm whitespace-nowrap" onClick={handleRunAi} disabled={aiLoading}>
              {aiLoading ? '分析中...' : aiSummary ? '再分析する' : 'AI分析を実行'}
            </button>
          </div>
          {aiError && <p className="mt-3 text-sm text-rose-600">{aiError}</p>}
          {aiSummary && <AiSummaryBody summary={aiSummary} />}
        </div>
      )}

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
                      <MyGoalPanel
                        year={y}
                        goal={myPrepSheet?.this_year_contribution ?? null}
                        editing={goalEditing}
                        draft={goalDraft}
                        saving={goalSaving}
                        onStartEdit={startGoalEdit}
                        onCancel={() => setGoalEditing(false)}
                        onSave={handleSaveGoal}
                        onDraftChange={setGoalDraft}
                      />
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
                          value={form[f.key]}
                          onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        />
                        <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2">
                          <p className="mb-0.5 text-[11px] font-medium text-slate-400">記入例（そのままコピーする内容ではありません）</p>
                          <p className="whitespace-pre-wrap text-xs text-slate-400">{f.example}</p>
                        </div>
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
              <MyGoalPanel
                year={y}
                goal={myPrepSheet?.this_year_contribution ?? null}
                editing={goalEditing}
                draft={goalDraft}
                saving={goalSaving}
                onStartEdit={startGoalEdit}
                onCancel={() => setGoalEditing(false)}
                onSave={handleSaveGoal}
                onDraftChange={setGoalDraft}
              />
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

// 自分の年間目標（事前シート③）を月報の「目標への進捗」からその場で編集できるパネル。
// 事前シートの残り3項目（②年後の理想像など）を開かせずに、この1行だけ更新できるようにする。
// 保存先は事前シートと同じ board_prep_sheets（this_year_contribution）。
function MyGoalPanel({
  year, goal, editing, draft, saving, onStartEdit, onCancel, onSave, onDraftChange,
}: {
  year: number
  goal: string | null
  editing: boolean
  draft: string
  saving: boolean
  onStartEdit: () => void
  onCancel: () => void
  onSave: () => void
  onDraftChange: (value: string) => void
}) {
  if (editing) {
    return (
      <div className="rounded-xl bg-slate-50 p-3.5">
        <p className="mb-1 text-xs font-semibold text-slate-400">{year}年の目標（事前シート③より）</p>
        <textarea
          className="input min-h-[80px] resize-y text-sm"
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
        />
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={onCancel}>キャンセル</button>
          <button type="button" className="btn-primary text-xs" onClick={onSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-400">{year}年の目標（事前シート③より）</p>
        <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={onStartEdit}>
          編集
        </button>
      </div>
      {goal ? (
        <p className="whitespace-pre-wrap text-sm text-slate-700">{goal}</p>
      ) : (
        <p className="text-sm text-slate-400">まだ記入されていません。「編集」から入力できます。</p>
      )}
    </div>
  )
}

// 事前シート③（今年、自分がSaludにもたらしたいこと）を「年間目標」として表示する、他の役員向けの読み取り専用パネル。
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
  const valueOf = (key: keyof MonthlyReportInput) => {
    if (key === 'actions') return mergedActions(report)
    if (key === 'next_month_actions') return mergedNextMonth(report)
    return report[key]
  }
  return (
    <div className="space-y-4">
      {REPORT_BLOCKS.map(block => {
        const visibleFields = block.fields.filter(f => valueOf(f.key))
        if (visibleFields.length === 0) return null
        return (
          <div key={block.heading} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5">
            <p className="mb-3 text-xs font-bold text-slate-500">{block.heading}</p>
            <div className="space-y-3">
              {visibleFields.map(f => (
                <div key={f.key} className="rounded-xl bg-white p-3">
                  <p className="mb-1 text-xs font-semibold text-brand-600">{f.label}</p>
                  <ReportText text={valueOf(f.key) ?? ''} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 保存された文章を、行の形に応じて読みやすく整形する。
// 「・」「-」始まりの行は箇条書き（折り返しがぶら下げインデントになる）、
// 「【見出し】」形式の行は小見出し、空行は行間として扱い、それ以外は通常の段落として表示する。
function ReportText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="text-sm text-slate-700">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (trimmed === '') return <div key={i} className="h-2" />
        const heading = trimmed.match(/^【(.+)】$/)
        if (heading) {
          return (
            <p key={i} className="mb-1 mt-2.5 text-xs font-semibold text-slate-500 first:mt-0">
              {trimmed}
            </p>
          )
        }
        const bullet = trimmed.match(/^[・･\-]\s*(.+)$/)
        if (bullet) {
          return (
            <div key={i} className="flex gap-1.5 py-0.5 pl-0.5">
              <span className="shrink-0 text-slate-300">・</span>
              <span className="whitespace-pre-wrap">{bullet[1]}</span>
            </div>
          )
        }
        return (
          <p key={i} className="whitespace-pre-wrap py-0.5">
            {line}
          </p>
        )
      })}
    </div>
  )
}

const AI_SUMMARY_LISTS: { key: keyof Pick<MonthlyReportSummary, 'highlights' | 'risks' | 'discussionAgenda' | 'advice'>; label: string }[] = [
  { key: 'highlights',       label: '好調な点・進捗' },
  { key: 'risks',            label: '共通の課題' },
  { key: 'discussionAgenda', label: '月末会議のアジェンダ' },
  { key: 'advice',           label: 'アドバイス' },
]

function AiSummaryBody({ summary }: { summary: MonthlyReportSummary }) {
  return (
    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
      {summary.overview && (
        <p className="whitespace-pre-wrap text-sm text-slate-700">{summary.overview}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {AI_SUMMARY_LISTS.map(({ key, label }) => {
          const items = summary[key]
          if (!items || items.length === 0) return null
          return (
            <div key={key} className="rounded-xl bg-slate-50 p-3.5">
              <p className="mb-1.5 text-xs font-semibold text-brand-600">{label}</p>
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="flex gap-1.5 text-sm text-slate-700">
                    <span className="shrink-0 text-slate-300">・</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
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
