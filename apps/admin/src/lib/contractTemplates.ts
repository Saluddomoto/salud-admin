// 契約書テンプレートのレンダリングユーティリティ。
// テンプレート本文自体はDB(contract_templates)に保存され、画面から編集できる。
// 本文中の【…】プレースホルダーを入力値で置換して契約書を生成する。

export type ContractInput = {
  partnerName: string
  partnerAddress: string
  representativeName: string
  contractDate: string // YYYY-MM-DD
}

// 西暦 → 令和表記（令和元年=2019年）
export function toReiwa(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const year = d.getFullYear() - 2018
  const yearLabel = year === 1 ? '元' : String(year)
  return `令和${yearLabel}年${d.getMonth() + 1}月${d.getDate()}日`
}

export const CONTRACT_PLACEHOLDERS: { token: string; label: string; resolve: (input: ContractInput) => string }[] = [
  { token: '【相手先会社名】', label: '相手先会社名', resolve: i => i.partnerName },
  { token: '【相手先住所】', label: '相手先住所', resolve: i => i.partnerAddress },
  { token: '【代表者名】', label: '代表者名', resolve: i => i.representativeName },
  { token: '【契約日】', label: '契約日（令和表記に自動変換）', resolve: i => toReiwa(i.contractDate) },
]

export function renderContractBody(bodyTemplate: string, input: ContractInput): string {
  return CONTRACT_PLACEHOLDERS.reduce(
    (text, { token, resolve }) => text.split(token).join(resolve(input)),
    bodyTemplate,
  )
}
