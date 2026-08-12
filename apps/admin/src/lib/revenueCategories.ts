import type { DbProject, DbRevenueEntry } from '@/lib/db'

// 商品カテゴリ別の年間目標（Excel「目標管理シート」入力_前提シート相当のデフォルト値）。
// 年ごとの実際の目標値は revenue_category_targets テーブルで上書き可能（/revenue の目標設定タブ）。
// 件数×単価＝目標売上（isMonthly のカテゴリは ×12 した月額換算）、原価率から目標粗利を算出する。
export type RevenueCategory = {
  name: string
  annualTargetCount: number
  unitPrice: number
  costRate: number
  // 補助金パイプライン(見込み〜申請済み)の売上予測に使う採択率。補助金カテゴリのみ設定。
  acceptanceRate?: number
  // true: 月額×12ヶ月で年間目標売上を計算する（伴走・保守・SEO支援など毎月発生するもの）
  isMonthly?: boolean
  memo?: string
}

export const REVENUE_CATEGORIES: RevenueCategory[] = [
  { name: '持続化補助金',       annualTargetCount: 28, unitPrice: 290_000,   costRate: 0.206, acceptanceRate: 0.7 },
  { name: '省力化補助金',       annualTargetCount: 10, unitPrice: 750_000,   costRate: 0.2,   acceptanceRate: 0.6 },
  { name: '新事業進出補助金',   annualTargetCount: 6,  unitPrice: 2_200_000, costRate: 0.25,  acceptanceRate: 0.4 },
  { name: 'ものづくり補助金',   annualTargetCount: 3,  unitPrice: 500_000,   costRate: 0.2,   acceptanceRate: 0.5 },
  { name: 'HP制作',            annualTargetCount: 6,  unitPrice: 750_000,   costRate: 0.4 },
  { name: '伴走',              annualTargetCount: 10, unitPrice: 15_000,    costRate: 0.6, isMonthly: true, memo: '持続化補助金経由の顧客は15,000円/月、それ以外は30,000円/月と幅あり（単価は加重平均目安）' },
  { name: '保守',              annualTargetCount: 4,  unitPrice: 7_000,     costRate: 0.1, isMonthly: true },
  { name: 'SEO支援',           annualTargetCount: 1,  unitPrice: 100_000,   costRate: 0.3, isMonthly: true },
  { name: 'ビビッドガーデン売上', annualTargetCount: 1, unitPrice: 3_000_000, costRate: 0.3 },
  { name: 'その他',            annualTargetCount: 0,  unitPrice: 0,         costRate: 0.3 },
]

export const REVENUE_CATEGORY_NAMES = REVENUE_CATEGORIES.map(c => c.name)

export function findRevenueCategory(name: string): RevenueCategory | null {
  return REVENUE_CATEGORIES.find(c => c.name === name) ?? null
}

// カテゴリの年間目標売上（isMonthly なら 件数×単価×12、それ以外は 件数×単価）
export function annualTargetAmount(cat: RevenueCategory): number {
  return cat.annualTargetCount * cat.unitPrice * (cat.isMonthly ? 12 : 1)
}

// 案件管理の「補助金名」(自由入力含む)を売上カテゴリに寄せるための簡易マッチング。
// 「新事業進出・ものづくり補助金」のように複合名は「ものづくり」を優先する(要目視確認)。
const SUBSIDY_NAME_PATTERNS: [pattern: string, category: string][] = [
  ['持続化', '持続化補助金'],
  ['省力化', '省力化補助金'],
  ['ものづくり', 'ものづくり補助金'],
  ['新事業進出', '新事業進出補助金'],
]

export function matchRevenueCategoryFromSubsidyName(subsidyName: string): RevenueCategory | null {
  const exact = findRevenueCategory(subsidyName)
  if (exact) return exact
  for (const [pattern, category] of SUBSIDY_NAME_PATTERNS) {
    if (subsidyName.includes(pattern)) return findRevenueCategory(category)
  }
  return null
}

export type CategoryAcceptanceStat = {
  acceptedFromProjects: number
  acceptedFromLedger: number
  accepted: number
  rejected: number
  pending: number
  decided: number
  actualRate: number | null // 0-1
}

// 採択率(実績)をパイプライン予測に使い始めるための最低決定件数（採択+不採択）。
// これ未満のうちは実績が不安定なので REVENUE_CATEGORIES の固定値を使い続ける。
export const MIN_DECIDED_FOR_ACTUAL_ACCEPTANCE_RATE = 3

// カテゴリ別に「案件管理のステータス」＋「売上台帳の確定済み過去実績」を突き合わせて
// 採択/不採択/審査中の件数を集計する。/subsidies のカテゴリ別実績タブと
// /revenue のパイプライン予測（採択率での加重）の両方から使う共通ロジック。
export function buildCategoryAcceptanceStats(
  projects: DbProject[],
  ledger: DbRevenueEntry[]
): Map<string, CategoryAcceptanceStat> {
  const map = new Map<string, CategoryAcceptanceStat>()
  const stat = (name: string) => {
    let s = map.get(name)
    if (!s) {
      s = { acceptedFromProjects: 0, acceptedFromLedger: 0, accepted: 0, rejected: 0, pending: 0, decided: 0, actualRate: null }
      map.set(name, s)
    }
    return s
  }

  for (const p of projects) {
    if (p.project_type === 'web') continue
    const cat = matchRevenueCategoryFromSubsidyName(p.subsidy_name ?? '')
    const name = cat?.name ?? 'その他・未分類'
    const s = stat(name)
    if (p.status === 'accepted' || p.status === 'completed') s.acceptedFromProjects++
    else if (p.status === 'rejected') s.rejected++
    else if (p.status === 'submitted') s.pending++
  }

  for (const entry of ledger) {
    if (entry.status !== 'confirmed') continue
    if (!map.has(entry.category)) continue // 案件管理に一件も無いカテゴリは対象外
    stat(entry.category).acceptedFromLedger++
  }

  for (const s of map.values()) {
    s.accepted = s.acceptedFromProjects + s.acceptedFromLedger
    s.decided = s.accepted + s.rejected
    s.actualRate = s.decided > 0 ? s.accepted / s.decided : null
  }

  return map
}

// パイプライン予測の加重に使う採択率を決める。実績の決定件数が十分に貯まっていれば
// 実績値を、そうでなければカテゴリの固定値（業界目安）を使う。
export function resolveAcceptanceRate(defaultRate: number | undefined, stat: CategoryAcceptanceStat | undefined): number | undefined {
  if (stat && stat.decided >= MIN_DECIDED_FOR_ACTUAL_ACCEPTANCE_RATE && stat.actualRate != null) {
    return stat.actualRate
  }
  return defaultRate
}
