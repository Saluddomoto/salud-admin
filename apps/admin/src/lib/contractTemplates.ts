// 契約書テンプレートのレンダリングユーティリティ。
// テンプレート本文・差し込み項目(fields)はDB(contract_templates)に保存され、画面から編集できる。
// 本文中の【…】プレースホルダーを入力値で置換して契約書を生成する。

export type ContractFieldType = 'text' | 'date' | 'select'

// select: フォームでは label を選び、本文には選んだ選択肢の value（複数行可）を差し込む。先頭の選択肢が既定値。
export type ContractFieldOption = {
  label: string
  value: string
}

export type ContractField = {
  token: string
  label: string
  type: ContractFieldType
  options?: ContractFieldOption[]
}

function resolveSelect(field: ContractField, raw: string | undefined): string {
  const options = field.options ?? []
  return (options.find(o => o.label === raw) ?? options[0])?.value ?? ''
}

// 西暦 → 令和表記（令和元年=2019年）
export function toReiwa(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const year = d.getFullYear() - 2018
  const yearLabel = year === 1 ? '元' : String(year)
  return `令和${yearLabel}年${d.getMonth() + 1}月${d.getDate()}日`
}

// values: フォーム入力値そのまま（dateはYYYY-MM-DD）。type=dateは令和表記に変換してから置換する。
export function renderContractBody(bodyTemplate: string, fields: ContractField[], values: Record<string, string>): string {
  return fields.reduce((text, field) => {
    const raw = values[field.token] ?? ''
    const resolved = field.type === 'date' ? toReiwa(raw)
      : field.type === 'select' ? resolveSelect(field, values[field.token])
      : raw
    return text.split(field.token).join(resolved)
  }, bodyTemplate)
}
