'use client'

import { useState } from 'react'

// 税抜/税込どちらからでも入力できる金額フィールド。
// フォーム送信時は常に税抜(name)の値を送る。
export function TaxAmountInput({
  name,
  label,
  defaultValueExclTax,
}: {
  name: string
  label: string
  defaultValueExclTax?: number | null
}) {
  const [excl, setExcl] = useState(defaultValueExclTax != null ? String(defaultValueExclTax) : '')
  const [incl, setIncl] = useState(
    defaultValueExclTax != null ? String(Math.round(defaultValueExclTax * 1.1)) : ''
  )

  const onExclChange = (v: string) => {
    setExcl(v)
    setIncl(v ? String(Math.round(Number(v) * 1.1)) : '')
  }
  const onInclChange = (v: string) => {
    setIncl(v)
    setExcl(v ? String(Math.round(Number(v) / 1.1)) : '')
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            type="number" className="input" placeholder="税抜"
            value={excl} onChange={e => onExclChange(e.target.value)}
          />
          <p className="mt-0.5 text-xs text-slate-400">税抜</p>
        </div>
        <div>
          <input
            type="number" className="input" placeholder="税込"
            value={incl} onChange={e => onInclChange(e.target.value)}
          />
          <p className="mt-0.5 text-xs text-slate-400">税込</p>
        </div>
      </div>
      <input type="hidden" name={name} value={excl} />
    </div>
  )
}
