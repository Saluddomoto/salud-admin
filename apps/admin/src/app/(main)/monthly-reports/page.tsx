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

const FIELDS: { key: keyof MonthlyReportInput; label: string; hint: string; example: string }[] = [
  {
    key: 'actions',
    label: '行動',
    hint: '今月、主体的に動いたこと・意思決定したこと',
    example: '例）スタッフの案件対応が滞っていたので進め方を一緒に整理した／新規顧客A社との商談前に業界動向を調べて提案資料を作り直した',
  },
  {
    key: 'sales',
    label: '営業',
    hint: '商談・提案・新規開拓の動き',
    example: '例）B社と初回商談、ものづくり補助金を提案／税理士C氏からの紹介案件を2件フォロー／セミナーで名刺交換した5社に個別フォロー',
  },
  {
    key: 'tasks',
    label: 'タスク',
    hint: 'この月に完了したタスク（下のボタンでタスク管理から箇条書きを読み込めます）',
    example: '例）・A社 持続化補助金の申請書を提出\n・B社 見積書を送付\n・月次の請求書取りまとめ',
  },
  {
    key: 'initiatives',
    label: '取り組んだこと',
    hint: '新しく始めた取り組み・改善・学び',
    example: '例）LINE問い合わせ対応マニュアルを整備した／新しい補助金情報のキャッチアップ会を月1で開始した／申請書のひな形を見直して作成時間を短縮した',
  },
]

const EMPTY_INPUT: MonthlyReportInput = { actions: '', sales: '', tasks: '', initiatives: '' }

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
    setForm(myReport
      ? {
          actions: myReport.actions ?? '',
          sales: myReport.sales ?? '',
          tasks: myReport.tasks ?? '',
          initiatives: myReport.initiatives ?? '',
        }
      : EMPTY_INPUT)
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
                {myReport && !editing && (
                  <p className="text-xs text-slate-400">
                    最終更新: {new Date(myReport.updated_at).toLocaleString('ja-JP')}
                  </p>
                )}
              </div>
            </div>
            {!editing && (
              <button className="btn-secondary text-sm" onClick={() => setEditing(true)}>
                {myReport ? '編集' : 'この月の報告を書く'}
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-slate-700">{f.label}</label>
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
                  <p className="mb-1.5 text-xs text-slate-400">{f.example}</p>
                  <textarea
                    className="input min-h-[80px] resize-y"
                    placeholder={f.hint}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => { setEditing(false); setForm(myReport
                    ? { actions: myReport.actions ?? '', sales: myReport.sales ?? '', tasks: myReport.tasks ?? '', initiatives: myReport.initiatives ?? '' }
                    : EMPTY_INPUT) }}
                >
                  キャンセル
                </button>
                <button className="btn-primary text-sm" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : myReport ? (
            <ReportBody report={myReport} />
          ) : (
            <p className="text-sm text-slate-400">この月の報告はまだありません。</p>
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
            return (
              <div key={ex.id} className="card p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                      {ex.full_name?.[0] ?? '?'}
                    </span>
                    <p className="font-semibold text-slate-900">{ex.full_name}</p>
                  </div>
                  {r && (
                    <p className="text-xs text-slate-400">
                      更新: {new Date(r.updated_at).toLocaleDateString('ja-JP')}
                    </p>
                  )}
                </div>
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

function ReportBody({ report }: { report: DbMonthlyReport }) {
  return (
    <div className="space-y-3">
      {FIELDS.map(f => {
        const value = report[f.key]
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
