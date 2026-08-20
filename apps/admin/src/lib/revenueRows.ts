// 案件・売上台帳・月額契約から「売上行」を導出するロジック。
// /revenue（売上台帳・月次実績・売上予測）と ダッシュボードの売上サマリーの両方から使う
// 共通の計算元 — ここを分けて重複実装すると、画面ごとに数字がズレる原因になる。
import { addMonths, type DbProject, type DbRevenueEntry, type DbRecurringContract } from '@/lib/db'
import {
  matchRevenueCategoryFromSubsidyName, buildCategoryAcceptanceStats, resolveAcceptanceRate,
  businessLineOfCategory, type RevenueBusinessLine,
} from '@/lib/revenueCategories'

export type Row = {
  id: string
  entry_date: string
  payer_name: string
  category: string
  amount_excl_tax: number
  status: 'confirmed' | 'forecast'
  payment_due_date: string | null
  payment_received_date: string | null
  memo: string | null
  source: 'manual' | 'project'
  projectId?: string
}

export function deriveProjectRows(projects: DbProject[]): Row[] {
  const rows: Row[] = []
  for (const p of projects) {
    const payer = p.customers?.company_name ?? '—'
    if (p.project_type === 'web') {
      if (p.web_fee_excl_tax == null) continue
      const date = p.payment_received_date ?? p.payment_due_date
      if (!date) continue
      rows.push({
        id: `project-${p.id}`,
        entry_date: date,
        payer_name: payer,
        category: 'HP制作',
        amount_excl_tax: p.web_fee_excl_tax,
        status: p.payment_received_date ? 'confirmed' : 'forecast',
        payment_due_date: p.payment_due_date,
        payment_received_date: p.payment_received_date,
        memo: null,
        source: 'project',
        projectId: p.id,
      })
    } else if (p.status === 'accepted') {
      const amount = (p.base_fee ?? 0) + (p.subsidy_amount ?? 0) * ((p.success_fee_rate ?? 0) / 100)
      const date = p.result_at ?? p.deadline
      if (amount <= 0 || !date) continue
      rows.push({
        id: `project-${p.id}`,
        entry_date: date,
        payer_name: payer,
        category: matchRevenueCategoryFromSubsidyName(p.subsidy_name ?? '')?.name ?? 'その他',
        amount_excl_tax: amount,
        status: 'confirmed',
        payment_due_date: null,
        payment_received_date: null,
        memo: null,
        source: 'project',
        projectId: p.id,
      })
    } else if (p.status === 'submitted') {
      // 申請済み案件は「採択されたらもらえる満額」を見込み（下書き）として台帳に出す。
      // 採択率での加重はしない（それは月次集計側の別枠 = derivePipelineForecastRows が担う）。
      // 基本料金・成功報酬率が未入力（契約条件が後決めのケース）でも下書きが出るよう、
      // その場合はカテゴリの平均単価（目標設定タブの単価）を暫定額として使う。
      // 後から成功報酬率を入力すれば、そちらの実額計算に自動で置き換わる。
      const cat = matchRevenueCategoryFromSubsidyName(p.subsidy_name ?? '')
      const preciseAmount = (p.base_fee ?? 0) + (p.subsidy_amount ?? p.applied_amount ?? 0) * ((p.success_fee_rate ?? 0) / 100)
      const isEstimate = preciseAmount <= 0
      const amount = isEstimate ? (cat?.unitPrice ?? 0) : preciseAmount
      const date = p.deadline
      if (amount <= 0 || !date) continue
      rows.push({
        id: `project-${p.id}`,
        entry_date: date,
        payer_name: payer,
        category: cat?.name ?? 'その他',
        amount_excl_tax: amount,
        status: 'forecast',
        payment_due_date: null,
        payment_received_date: null,
        memo: isEstimate ? '申請中の見込み（金額未定・カテゴリ平均額で暫定計算）' : '申請中の見込み（下書き）',
        source: 'project',
        projectId: p.id,
      })
    }
  }
  return rows
}

// 補助金パイプライン(見込み〜申請準備中、まだ申請していない案件)を
// カテゴリの採択率で加重し、売上予測(見込み)にのみ計上する。
// 実際の入金が発生したわけではないため売上台帳の一覧には出さない。
// 申請済み(submitted)はここでは扱わない — deriveProjectRows が満額の下書き行として
// 売上台帳に直接出すため、ここに含めると月次集計が二重計上になる。
//
// 申請額(applied_amount)はクライアントが国に申請する補助金額であり
// Saludの売上ではない。Saludの売上は「基本料金＋採択額×成功報酬率」
// (採択済み案件と同じ式)。採択前は採択額が未確定なので申請額を代用し、
// 成功報酬部分だけを採択率で加重する(基本料金は契約時に確定済みとみなし加重しない)。
//
// 加重に使う採択率は、/subsidies のカテゴリ別実績と同じ buildCategoryAcceptanceStats で
// 決定件数(採択+不採択)を数え、一定数貯まったカテゴリは実績値を、そうでなければ
// REVENUE_CATEGORIES の固定値(業界目安)を使う(resolveAcceptanceRate)。
// つまり案件の不採択が記録されるほど、そのカテゴリの見込み売上は実態に近づく。
export function derivePipelineForecastRows(projects: DbProject[], ledger: DbRevenueEntry[]): Row[] {
  const acceptanceStats = buildCategoryAcceptanceStats(projects, ledger)
  const rows: Row[] = []
  for (const p of projects) {
    if (p.project_type !== 'subsidy') continue
    if (!['planning', 'in_progress'].includes(p.status)) continue
    const cat = matchRevenueCategoryFromSubsidyName(p.subsidy_name ?? '')
    if (!cat) continue
    const rate = resolveAcceptanceRate(cat.acceptanceRate, acceptanceStats.get(cat.name))
    if (!rate) continue
    const expectedSubsidyAmount = p.subsidy_amount ?? p.applied_amount ?? 0
    const successFeePortion = expectedSubsidyAmount * ((p.success_fee_rate ?? 0) / 100)
    const amount = Math.round((p.base_fee ?? 0) + successFeePortion * rate)
    const date = p.deadline
    if (amount <= 0 || !date) continue
    const isActual = rate !== cat.acceptanceRate
    rows.push({
      id: `pipeline-${p.id}`,
      entry_date: date,
      payer_name: p.customers?.company_name ?? '—',
      category: cat.name,
      amount_excl_tax: amount,
      status: 'forecast',
      payment_due_date: null,
      payment_received_date: null,
      memo: `パイプライン見込み（採択率${Math.round(rate * 100)}%${isActual ? '・実績値' : ''}で加重）`,
      source: 'project',
      projectId: p.id,
    })
  }
  return rows
}

// 月額契約は当月分までしか売上台帳(revenue_ledger)に反映しない(syncRecurringContracts)。
// 今後も継続する前提のものなので、来月〜表示中の年の12月までは
// 「見込み」として売上予測にのみ投影する(台帳には書き込まない)。
export function deriveFutureContractForecastRows(contracts: DbRecurringContract[], year: number): Row[] {
  const rows: Row[] = []
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const yearEnd = `${year}-12-01`

  for (const c of contracts) {
    let cursor = c.last_generated_month ? addMonths(c.last_generated_month, 1) : c.start_month
    if (cursor <= thisMonth) cursor = addMonths(thisMonth, 1)
    const stop = c.end_month && c.end_month < yearEnd ? c.end_month : yearEnd

    while (cursor <= stop) {
      rows.push({
        id: `contract-forecast-${c.id}-${cursor}`,
        entry_date: cursor,
        payer_name: c.payer_name,
        category: c.category,
        amount_excl_tax: c.monthly_amount_excl_tax,
        status: 'forecast',
        payment_due_date: null,
        payment_received_date: null,
        memo: '月額契約の今後の見込み',
        source: 'project',
      })
      cursor = addMonths(cursor, 1)
    }
  }
  return rows
}

// 台帳(manual)＋案件由来の行を合わせた「売上台帳」全行（画面表示用のソートはしない）。
export function buildLedgerRows(manual: DbRevenueEntry[], projects: DbProject[]): Row[] {
  const manualRows: Row[] = manual.map(r => ({ ...r, source: 'manual' as const }))
  return [...manualRows, ...deriveProjectRows(projects)]
}

// 売上行を事業ライン（補助金事業／WEB事業／その他）別に合算する。
// ダッシュボードの売上管理カードや /revenue の事業別サマリーで、
// 「ウェブ売上」と「補助金事業の売上」を分けて見せるために使う共通集計。
export function sumRowsByBusinessLine(rows: Row[]): Record<RevenueBusinessLine, number> {
  const totals: Record<RevenueBusinessLine, number> = { subsidy: 0, web: 0, other: 0 }
  for (const r of rows) {
    totals[businessLineOfCategory(r.category)] += r.amount_excl_tax
  }
  return totals
}
