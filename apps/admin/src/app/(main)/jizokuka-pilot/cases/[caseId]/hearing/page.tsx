'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  fetchCaseDetail, saveHearing, generateInitialDraft,
  type JizokukaCase, type JizokukaHearing, type SalesEffect, type ScheduleItem, type TopService,
} from '@/lib/jizokuka/db'
import { forecastSales } from '@/lib/jizokuka/hearing-sheet'
import { StepNav, StepTabs } from '@/components/jizokuka/step-nav'
import { HearingSheetImport } from '@/components/jizokuka/hearing-sheet-import'
import { buildFieldsDocxBlob, downloadBlob } from '@/lib/jizokuka/word-export'

// 画面の構成は「ヒアリングシート（2026）」の 2.現状分析 / 3.今後の事業について に合わせている。
// SWOT の列には、シートの質問を次のとおり対応させて保存する
//   強み←自社のこだわり / 弱み←現在課題に感じていること / 機会←プラスの動向 / 脅威←マイナスの動向

type FormState = {
  industry: string
  employee_count: string
  recent_revenue: string
  top_services: { name: string; ratio_pct: string; unit_price: string }[]
  customer_segments: string
  swot_strength: string
  swot_weakness: string
  swot_opportunity: string
  swot_threat: string
  subsidy_goal: string
  sales_effects: { target: string; offering: string; unit_price: string; customers: string; frequency: string }[]
  gross_margin_pct: string
  growth_pct: string
  appeal_points: string
  market_trends: string
  business_policy_goal: string
  future_plan: string
  // ヒアリングシート v2「4.補足情報」
  implementation_schedule: { task: string; start: string; end: string }[]
  efficiency_enabled: string // '' | 'true' | 'false'
  efficiency_items: string
  efficiency_current: string
  efficiency_effect: string
  order_channels: string
  marketing_issues: string
  payment_terms: string
  expansion_plans: string
  profit_target: string
  founder_background: string
  company_history: string
  market_sources: string
  customer_examples: string
  track_record: string
  attachments_note: string
}

const ROWS = 3
const SCHEDULE_ROWS = 6
const pad = <T,>(rows: T[], blank: T): T[] => [...rows, ...Array.from({ length: ROWS }, () => blank)].slice(0, ROWS)
const s = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v))

function toFormState(h: JizokukaHearing): FormState {
  return {
    industry: s(h.industry),
    employee_count: s(h.employee_count),
    recent_revenue: s(h.recent_revenue),
    top_services: pad(
      (h.top_services ?? []).map(t => ({ name: t.name, ratio_pct: s(t.ratio_pct), unit_price: s(t.unit_price) })),
      { name: '', ratio_pct: '', unit_price: '' },
    ),
    customer_segments: s(h.customer_segments),
    swot_strength: s(h.swot_strength),
    swot_weakness: s(h.swot_weakness),
    swot_opportunity: s(h.swot_opportunity),
    swot_threat: s(h.swot_threat),
    subsidy_goal: s(h.subsidy_goal),
    sales_effects: pad(
      (h.sales_effects ?? []).map(e => ({
        target: e.target, offering: e.offering,
        unit_price: s(e.unit_price), customers: s(e.customers), frequency: s(e.frequency),
      })),
      { target: '', offering: '', unit_price: '', customers: '', frequency: '' },
    ),
    gross_margin_pct: s(h.gross_margin_pct),
    growth_pct: s(h.growth_pct),
    appeal_points: s(h.appeal_points),
    market_trends: s(h.market_trends),
    business_policy_goal: s(h.business_policy_goal),
    future_plan: s(h.future_plan),
    implementation_schedule: [
      ...(h.implementation_schedule ?? []),
      ...Array.from({ length: SCHEDULE_ROWS }, () => ({ task: '', start: '', end: '' })),
    ].slice(0, SCHEDULE_ROWS),
    efficiency_enabled: h.efficiency_enabled == null ? '' : String(h.efficiency_enabled),
    efficiency_items: s(h.efficiency_items),
    efficiency_current: s(h.efficiency_current),
    efficiency_effect: s(h.efficiency_effect),
    order_channels: s(h.order_channels),
    marketing_issues: s(h.marketing_issues),
    payment_terms: s(h.payment_terms),
    expansion_plans: s(h.expansion_plans),
    profit_target: s(h.profit_target),
    founder_background: s(h.founder_background),
    company_history: s(h.company_history),
    market_sources: s(h.market_sources),
    customer_examples: s(h.customer_examples),
    track_record: s(h.track_record),
    attachments_note: s(h.attachments_note),
  }
}

const EMPTY: FormState = toFormState({} as JizokukaHearing)
const numOrNull = (v: string) => (v === '' ? null : Number(v))

function Area({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="mb-1 text-xs text-slate-400">{hint}</p>}
      <textarea className="input min-h-24" value={value} onChange={ev => onChange(ev.target.value)} />
    </div>
  )
}

export default function HearingPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const router = useRouter()
  const [caseInfo, setCaseInfo] = useState<JizokukaCase | null>(null)
  const [hearing, setHearing] = useState<JizokukaHearing | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetchCaseDetail(caseId).then(({ case: c, hearing }) => {
      setCaseInfo(c)
      setHearing(hearing)
      setForm(toFormState(hearing))
    }).finally(() => setLoading(false))
  }, [caseId])

  const set = (key: keyof FormState) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: ev.target.value }))
  const setText = (key: keyof FormState) => (v: string) => setForm(f => ({ ...f, [key]: v }))

  const setRow = <K extends 'top_services' | 'sales_effects'>(key: K, i: number, field: string, v: string) =>
    setForm(f => ({
      ...f,
      [key]: f[key].map((row, idx) => (idx === i ? { ...row, [field]: v } : row)),
    }))

  const setSchedule = (i: number, field: 'task' | 'start' | 'end', v: string) =>
    setForm(f => ({
      ...f,
      implementation_schedule: f.implementation_schedule.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)),
    }))

  const topServices = (): TopService[] =>
    form.top_services
      .filter(t => t.name.trim())
      .map(t => ({ name: t.name.trim(), ratio_pct: numOrNull(t.ratio_pct), unit_price: numOrNull(t.unit_price) }))

  const salesEffects = (): SalesEffect[] =>
    form.sales_effects
      .filter(e => e.target.trim() || e.offering.trim() || e.unit_price)
      .map(e => ({
        target: e.target.trim(), offering: e.offering.trim(),
        unit_price: numOrNull(e.unit_price), customers: numOrNull(e.customers), frequency: numOrNull(e.frequency),
      }))

  const buildHearingPayload = () => ({
    industry: form.industry || null,
    employee_count: numOrNull(form.employee_count),
    recent_revenue: form.recent_revenue || null,
    top_services: topServices(),
    customer_segments: form.customer_segments || null,
    swot_strength: form.swot_strength || null,
    swot_weakness: form.swot_weakness || null,
    swot_opportunity: form.swot_opportunity || null,
    swot_threat: form.swot_threat || null,
    subsidy_goal: form.subsidy_goal || null,
    sales_effects: salesEffects(),
    gross_margin_pct: numOrNull(form.gross_margin_pct),
    growth_pct: numOrNull(form.growth_pct),
    appeal_points: form.appeal_points || null,
    market_trends: form.market_trends || null,
    business_policy_goal: form.business_policy_goal || null,
    future_plan: form.future_plan || null,
    implementation_schedule: form.implementation_schedule
      .filter(i => i.task.trim() || i.start.trim() || i.end.trim())
      .map((i): ScheduleItem => ({ task: i.task.trim(), start: i.start.trim(), end: i.end.trim() })),
    efficiency_enabled: form.efficiency_enabled === '' ? null : form.efficiency_enabled === 'true',
    efficiency_items: form.efficiency_items || null,
    efficiency_current: form.efficiency_current || null,
    efficiency_effect: form.efficiency_effect || null,
    order_channels: form.order_channels || null,
    marketing_issues: form.marketing_issues || null,
    payment_terms: form.payment_terms || null,
    expansion_plans: form.expansion_plans || null,
    profit_target: form.profit_target || null,
    founder_background: form.founder_background || null,
    company_history: form.company_history || null,
    market_sources: form.market_sources || null,
    customer_examples: form.customer_examples || null,
    track_record: form.track_record || null,
    attachments_note: form.attachments_note || null,
  })

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    setGenerating(true)
    try {
      await saveHearing(caseId, buildHearingPayload())
      await generateInitialDraft(caseId)
      router.push(`/jizokuka-pilot/cases/${caseId}/review`)
    } catch (e) {
      alert(`保存・生成に失敗しました: ${e instanceof Error ? e.message : e}`)
      setGenerating(false)
    }
  }

  const persist = () => saveHearing(caseId, buildHearingPayload())

  const forecast = forecastSales(salesEffects(), numOrNull(form.gross_margin_pct), numOrNull(form.growth_pct))

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const blob = await buildFieldsDocxBlob(`${caseInfo?.business_name ?? '申請書'} ヒアリング内容`, [
        {
          heading: '現在の業務内容',
          fields: [
            { label: '業種', value: form.industry },
            { label: '従業員数', value: form.employee_count },
            { label: '直近売上（円）', value: form.recent_revenue },
            {
              label: '利益に貢献しているサービス上位3つ',
              value: topServices().map((t, i) => `${i + 1}位 ${t.name}（売上比${t.ratio_pct ?? '—'}%・平均単価${t.unit_price ?? '—'}円）`).join('\n'),
            },
            { label: '主な顧客層', value: form.customer_segments },
            { label: '自社のこだわり', value: form.swot_strength },
            { label: '現在課題に感じていること', value: form.swot_weakness },
          ],
        },
        {
          heading: '経営環境',
          fields: [
            { label: 'プラスになる動向', value: form.swot_opportunity },
            { label: 'マイナスになる動向', value: form.swot_threat },
          ],
        },
        {
          heading: '今後の事業',
          fields: [
            { label: '補助金を使ってやりたいこと', value: form.subsidy_goal },
            {
              label: '売上の見込み',
              value: salesEffects().map(e => `${e.target}に「${e.offering}」：単価${e.unit_price ?? '—'}円×客数${e.customers ?? '—'}×月${e.frequency ?? '—'}回`).join('\n'),
            },
            { label: 'こだわりポイント（独自の工夫）', value: form.appeal_points },
          ],
        },
      ])
      downloadBlob(blob, `${caseInfo?.business_name ?? '申請書'}_ヒアリング内容.docx`)
    } catch {
      alert('Wordファイルの作成に失敗しました')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-400">読み込み中…</div>

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <StepTabs caseId={caseId} current="hearing" onSave={persist} />
      <PageHeader
        title={`ヒアリング — ${caseInfo?.business_name ?? ''}`}
        description="ヒアリングシート（現状分析・今後の事業）の項目です。クライアントが記入したシートを反映すると自動で入力されます"
      >
        <HearingSheetImport caseId={caseId} />
        <StepNav onSave={persist} />
        <button className="btn-secondary" onClick={handleDownload} disabled={downloading}>
          {downloading ? '作成中…' : 'Wordでダウンロード'}
        </button>
      </PageHeader>

      {hearing?.sheet_imported_at && (
        <div className="card border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          ヒアリングシート「{hearing.sheet_file_name}」を反映済み（{new Date(hearing.sheet_imported_at).toLocaleString('ja-JP')}）
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="card flex flex-col gap-4 p-5">
          <h3 className="text-sm font-bold text-slate-900">（1）現在の業務内容</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">業種</label>
              <input className="input" value={form.industry} onChange={set('industry')} placeholder="例: 飲食サービス業" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">従業員数</label>
              <input className="input" type="number" min={0} value={form.employee_count} onChange={set('employee_count')} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">直近売上（円）</label>
              <input className="input" type="number" min={0} value={form.recent_revenue} onChange={set('recent_revenue')} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">①利益に貢献しているサービス・商品の上位3つ</label>
            <div className="flex flex-col gap-2">
              {form.top_services.map((t, i) => (
                <div key={i} className="grid grid-cols-[2rem_1fr_6rem_8rem] items-center gap-2">
                  <span className="text-xs text-slate-500">{i + 1}位</span>
                  <input className="input" placeholder="サービス・商品カテゴリー名" value={t.name} onChange={ev => setRow('top_services', i, 'name', ev.target.value)} />
                  <input className="input" type="number" min={0} max={100} placeholder="売上比 %" value={t.ratio_pct} onChange={ev => setRow('top_services', i, 'ratio_pct', ev.target.value)} />
                  <input className="input" type="number" min={0} placeholder="平均単価（円）" value={t.unit_price} onChange={ev => setRow('top_services', i, 'unit_price', ev.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <Area label="②主な顧客層" hint="【対個人】年齢・性別・職業・エリア ／【対企業】企業規模・業種・エリア など（箇条書きで可）" value={form.customer_segments} onChange={setText('customer_segments')} />
          <Area label="③自社のこだわり（他社に比べて勝っている点）" hint="2〜3個程度" value={form.swot_strength} onChange={setText('swot_strength')} />
          <Area label="④現在課題に感じていること" hint="1〜2個程度" value={form.swot_weakness} onChange={setText('swot_weakness')} />
        </div>

        <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">（2）現在の経営環境</h3>
          <Area label="①経営にプラスになると感じている周辺・社会・世間の動向" hint="2〜3個程度" value={form.swot_opportunity} onChange={setText('swot_opportunity')} />
          <Area label="②経営にマイナスになると感じている周辺・社会・世間の動向" hint="2〜3個程度" value={form.swot_threat} onChange={setText('swot_threat')} />
        </div>

        <div className="card flex flex-col gap-4 p-5">
          <h3 className="text-sm font-bold text-slate-900">（3）補助金を使ってやりたいこと・売上の見込み</h3>
          <Area label="補助金を使ってやりたいこと" hint="経費明細ページの内容と合わせて、補助事業で具体的に何をやるかを記入" value={form.subsidy_goal} onChange={setText('subsidy_goal')} />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">どのように売上を伸ばせるか（1年後の目安）</label>
            <div className="flex flex-col gap-2">
              {form.sales_effects.map((e, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_7rem_6rem_6rem]">
                  <input className="input" placeholder="誰に（ターゲット顧客）" value={e.target} onChange={ev => setRow('sales_effects', i, 'target', ev.target.value)} />
                  <input className="input" placeholder="何を（商品・サービス）" value={e.offering} onChange={ev => setRow('sales_effects', i, 'offering', ev.target.value)} />
                  <input className="input" type="number" min={0} placeholder="単価（円）" value={e.unit_price} onChange={ev => setRow('sales_effects', i, 'unit_price', ev.target.value)} />
                  <input className="input" type="number" min={0} placeholder="客数" value={e.customers} onChange={ev => setRow('sales_effects', i, 'customers', ev.target.value)} />
                  <input className="input" type="number" min={0} placeholder="月何回" value={e.frequency} onChange={ev => setRow('sales_effects', i, 'frequency', ev.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">粗利率（%）</label>
              <input className="input" type="number" min={0} max={100} value={form.gross_margin_pct} onChange={set('gross_margin_pct')} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">売上増加率（年・%）</label>
              <input className="input" type="number" value={form.growth_pct} onChange={set('growth_pct')} />
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="text-left font-normal">今後3年間の売上予想（自動計算）</th>
                {forecast.map(f => <th key={f.year} className="text-right font-normal">{f.year}年後</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-xs text-slate-500">売上高</td>
                {forecast.map(f => <td key={f.year} className="text-right tabular-nums">{f.sales.toLocaleString()}円</td>)}
              </tr>
              <tr>
                <td className="text-xs text-slate-500">売上総利益</td>
                {forecast.map(f => <td key={f.year} className="text-right tabular-nums">{f.grossProfit == null ? '—' : `${f.grossProfit.toLocaleString()}円`}</td>)}
              </tr>
            </tbody>
          </table>

          <Area label="こだわりポイント（御社独自の工夫）" value={form.appeal_points} onChange={setText('appeal_points')} />
        </div>

        <div className="card flex flex-col gap-4 p-5">
          <h3 className="text-sm font-bold text-slate-900">（4）補足情報（ヒアリングシート「4.補足情報」）</h3>
          <p className="text-xs text-slate-400">実施時期・業務効率化・受注状況・利益率の目標です。ここが空欄だと、AI下書きに【要確認】が増えます</p>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">補助事業の実施時期</label>
            <div className="flex flex-col gap-2">
              {form.implementation_schedule.map((row, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_10rem]">
                  <input className="input" placeholder="取組内容（例：ホームページ制作）" value={row.task} onChange={ev => setSchedule(i, 'task', ev.target.value)} />
                  <input className="input" placeholder="開始月（例：2026年11月）" value={row.start} onChange={ev => setSchedule(i, 'start', ev.target.value)} />
                  <input className="input" placeholder="終了月" value={row.end} onChange={ev => setSchedule(i, 'end', ev.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">業務効率化（機械装置・ソフトウェア等の導入）</label>
              <select className="input sm:w-60" value={form.efficiency_enabled} onChange={ev => setForm(f => ({ ...f, efficiency_enabled: ev.target.value }))}>
                <option value="">経費の内容から自動判定</option>
                <option value="true">導入する（3-1・3-2を作成）</option>
                <option value="false">導入しない</option>
              </select>
            </div>
            <Area label="導入するもの（品目・機能・台数）" value={form.efficiency_items} onChange={setText('efficiency_items')} />
            <Area label="現在の作業方法と、非効率な点" hint="作業時間・人手・身体的負担など" value={form.efficiency_current} onChange={setText('efficiency_current')} />
            <Area label="導入後に変わること・見込み" hint="例：作業時間が20％短縮" value={form.efficiency_effect} onChange={setText('efficiency_effect')} />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4">
            <Area label="受注・集客経路の比率" hint="例：元請け6割／直請け4割、紹介・ポータルサイト経由 など" value={form.order_channels} onChange={setText('order_channels')} />
            <Area label="現在のホームページ・集客手段の問題点" hint="できるだけ具体的に（例：問い合わせボタンのリンクが機能していない）" value={form.marketing_issues} onChange={setText('marketing_issues')} />
            <Area label="入金までの期間（売上の回収サイト）" value={form.payment_terms} onChange={setText('payment_terms')} />
            <Area label="事務所・設備・人員の計画" hint="移転・増員・外注から自社雇用への切替 など" value={form.expansion_plans} onChange={setText('expansion_plans')} />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <Area label="利益率の目標" hint="例：現状2.5％→5％以上（売上の予想は、上の「（3）売上の見込み」を使います）" value={form.profit_target} onChange={setText('profit_target')} />
          </div>
        </div>

        <div className="card flex flex-col gap-4 p-5">
          <h3 className="text-sm font-bold text-slate-900">（5）〜（7）会社の沿革・市場の裏付け・掲載資料（ヒアリングシート「4.補足情報」）</h3>
          <Area label="代表者の経歴" hint="これまでの職歴・資格・独立の経緯" value={form.founder_background} onChange={setText('founder_background')} />
          <Area label="創業・事業の沿革" hint="設立の経緯、これまでの主な出来事" value={form.company_history} onChange={setText('company_history')} />
          <Area label="市場の動向の裏付けに使いたい統計・データ・出典" hint="公的統計・業界団体の発表など。AIは、ここに書かれた出典を優先して使います" value={form.market_sources} onChange={setText('market_sources')} />
          <Area label="顧客の具体例" hint="どんなお客様が、なぜ選ぶか（個人名は不要）" value={form.customer_examples} onChange={setText('customer_examples')} />
          <Area label="施工事例・実績" hint="件数・代表的な事例・お客様の声など" value={form.track_record} onChange={setText('track_record')} />
          <Area label="申請書に載せたい写真・資料" hint="施工事例、現在のホームページ、事務所の予定地など（ファイル名・保管場所）。Wordの下書きに、あとで手作業で貼り付けます" value={form.attachments_note} onChange={setText('attachments_note')} />
        </div>

        <details className="card p-5">
          <summary className="cursor-pointer text-sm font-bold text-slate-900">AI下書き用の補足（任意）</summary>
          <p className="mt-2 text-xs text-slate-400">ヒアリングシートに無い項目です。空欄でも、上の内容からAIが下書きを作成します</p>
          <div className="mt-4 flex flex-col gap-4">
            <Area label="市場の動向" value={form.market_trends} onChange={setText('market_trends')} />
            <Area label="経営方針・目標" value={form.business_policy_goal} onChange={setText('business_policy_goal')} />
            <Area label="今後のプラン" value={form.future_plan} onChange={setText('future_plan')} />
          </div>
        </details>

        <div className="flex items-center justify-end gap-3">
          <button type="submit" className="btn-primary" disabled={generating}>
            {generating ? 'AIが下書きを作成中…' : '保存してAI下書きを生成'}
          </button>
        </div>
      </form>
    </div>
  )
}
