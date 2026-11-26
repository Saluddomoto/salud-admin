import type { DbProject } from '@/lib/db'

// ゼスタス契約案件の「請求項目」（基本料金・成功報酬を1行ずつに分解したもの）。
// 請求リスト画面の月別合算と、請求書作成時の項目選択の両方で使う。
export type ZestasBillingItem = {
  key: string            // `${projectId}:${kind}`
  projectId: string
  kind: 'base' | 'success'
  month: string          // 請求対象月 'YYYY-MM'。日付が無いときは 'unset'
  customerName: string
  subsidyName: string
  amount: number
  billedDate: string | null
  paidDate: string | null  // ゼスタスから入金された日（未入金は null）
  invoiceName: string    // 請求書の「品目」欄に入れる文字列
  invoiceWork: string    // 請求書の「作業内容」欄に入れる文字列
}

export const UNSET_MONTH = 'unset'

export function monthLabel(month: string): string {
  if (month === UNSET_MONTH) return '日付未設定'
  const [y, m] = month.split('-')
  return `${y}年${Number(m)}月`
}

const toMonth = (date: string | null | undefined): string => (date ? date.slice(0, 7) : UNSET_MONTH)

export function successFeeAmount(p: Pick<DbProject, 'subsidy_amount' | 'applied_amount' | 'success_fee_rate'>): number {
  return Math.round((p.subsidy_amount ?? p.applied_amount ?? 0) * ((p.success_fee_rate ?? 0) / 100))
}

// 請求対象月の決め方:
//  請求済み → 請求した月 / 基本料金 → 入金予定日の月 / 成功報酬 → 採択発表日の月
export function buildZestasBillingItems(projects: DbProject[]): ZestasBillingItem[] {
  const items: ZestasBillingItem[] = []
  for (const p of projects) {
    if (p.contract_entity !== 'zestas' || p.status === 'lost' || p.status === 'rejected') continue
    const customerName = p.customers?.company_name ?? '（顧客未設定）'
    const subsidyName = p.project_type === 'web' ? 'WEB制作' : (p.subsidy_name ?? 'その他')

    const base = (p.project_type === 'web' ? p.web_fee_excl_tax : p.base_fee) ?? 0
    if (base > 0) {
      items.push({
        key: `${p.id}:base`, projectId: p.id, kind: 'base',
        month: toMonth(p.zestas_base_billed_date ?? p.payment_due_date),
        customerName, subsidyName, amount: base, billedDate: p.zestas_base_billed_date, paidDate: p.zestas_base_paid_date,
        invoiceName: `${customerName} ${subsidyName}`,
        invoiceWork: p.project_type === 'web' ? '制作費' : '基本料金',
      })
    }

    const success = successFeeAmount(p)
    if (p.project_type !== 'web' && (p.status === 'accepted' || p.status === 'completed') && success > 0) {
      items.push({
        key: `${p.id}:success`, projectId: p.id, kind: 'success',
        month: toMonth(p.zestas_success_billed_date ?? p.result_at),
        customerName, subsidyName, amount: success, billedDate: p.zestas_success_billed_date, paidDate: p.zestas_success_paid_date,
        invoiceName: `${customerName} ${subsidyName}`,
        invoiceWork: `成功報酬（${p.success_fee_rate}%）`,
      })
    }
  }
  return items.sort((a, b) =>
    a.month === b.month ? a.customerName.localeCompare(b.customerName, 'ja') : a.month === UNSET_MONTH ? 1 : b.month === UNSET_MONTH ? -1 : a.month.localeCompare(b.month))
}
