export type ForecastEffect = {
  unit_price: number | null
  customers: number | null
  frequency: number | null
}

/** 売上見込み（シートの数式と同じ: Σ(単価×客数×月頻度)×12、以降は年あたり増加率で伸長） */
export function forecastSales(
  effects: ForecastEffect[],
  grossMarginPct: number | null,
  growthPct: number | null,
) {
  const year1 = effects.reduce((s, e) => s + (e.unit_price ?? 0) * (e.customers ?? 0) * (e.frequency ?? 0), 0) * 12
  return [1, 2, 3].map(year => {
    const sales = Math.round(year1 * Math.pow((100 + (growthPct ?? 0)) / 100, year - 1))
    return {
      year,
      sales,
      grossProfit: grossMarginPct == null ? null : Math.round((sales * grossMarginPct) / 100),
    }
  })
}
