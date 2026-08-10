// 商品カテゴリ別の年間目標（Excel「目標管理シート」入力_前提シート相当）
// 件数×単価＝目標売上、原価率から目標粗利を算出する。
export type RevenueCategory = {
  name: string
  annualTargetCount: number
  unitPrice: number
  costRate: number
}

export const REVENUE_CATEGORIES: RevenueCategory[] = [
  { name: '持続化補助金',       annualTargetCount: 28, unitPrice: 290_000,   costRate: 0.206 },
  { name: '省力化補助金',       annualTargetCount: 10, unitPrice: 750_000,   costRate: 0.2 },
  { name: '新事業進出補助金',   annualTargetCount: 6,  unitPrice: 2_200_000, costRate: 0.25 },
  { name: 'ものづくり補助金',   annualTargetCount: 3,  unitPrice: 500_000,   costRate: 0.2 },
  { name: 'HP制作',            annualTargetCount: 6,  unitPrice: 750_000,   costRate: 0.4 },
  { name: '伴走',              annualTargetCount: 10, unitPrice: 30_000,    costRate: 0.6 },
  { name: '保守',              annualTargetCount: 4,  unitPrice: 7_000,     costRate: 0.1 },
  { name: 'SEO支援',           annualTargetCount: 1,  unitPrice: 100_000,   costRate: 0.3 },
  { name: 'その他',            annualTargetCount: 0,  unitPrice: 0,         costRate: 0.3 },
]

export const REVENUE_CATEGORY_NAMES = REVENUE_CATEGORIES.map(c => c.name)

export function findRevenueCategory(name: string): RevenueCategory | null {
  return REVENUE_CATEGORIES.find(c => c.name === name) ?? null
}
