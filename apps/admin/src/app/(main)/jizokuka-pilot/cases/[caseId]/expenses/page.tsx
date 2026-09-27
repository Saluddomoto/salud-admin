'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  fetchCaseDetail, fetchExpenseItems, addExpenseItem, updateExpenseItem, deleteExpenseItem, updateCaseFunding,
  type JizokukaCase, type JizokukaExpenseItem,
} from '@/lib/jizokuka/db'

const CATEGORIES = [
  '①機械装置等費', '②広報費', '③ウェブサイト関連費', '④展示会等出展費',
  '⑤旅費', '⑥新商品開発費', '⑦借料', '⑧委託・外注費', '⑨設備処分費',
]

function formatYen(n: number) {
  return `${Math.round(n).toLocaleString('ja-JP')}円`
}

function ExpenseRow({ item, onChange, onDelete }: {
  item: JizokukaExpenseItem
  onChange: (id: string, patch: Partial<JizokukaExpenseItem>) => void
  onDelete: (id: string) => void
}) {
  const [description, setDescription] = useState(item.description ?? '')
  const [amount, setAmount] = useState(item.amount.toString())

  const save = async (patch: Partial<Pick<JizokukaExpenseItem, 'category' | 'description' | 'amount' | 'is_website_related'>>) => {
    await updateExpenseItem(item.id, patch)
    onChange(item.id, patch)
  }

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-slate-100 py-3 sm:grid-cols-[1fr_2fr_1fr_auto] sm:items-center">
      <select
        className="input"
        value={item.category ?? ''}
        onChange={ev => {
          const category = ev.target.value
          const is_website_related = category === '③ウェブサイト関連費'
          save({ category, is_website_related })
        }}
      >
        <option value="">経費区分を選択</option>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        className="input"
        placeholder="内容（例: 瓶ラベルデザイン制作）"
        value={description}
        onChange={ev => setDescription(ev.target.value)}
        onBlur={() => save({ description })}
      />
      <input
        className="input"
        type="number"
        min={0}
        placeholder="金額（円）"
        value={amount}
        onChange={ev => setAmount(ev.target.value)}
        onBlur={() => save({ amount: Number(amount) || 0 })}
      />
      <button type="button" className="btn-secondary" onClick={() => onDelete(item.id)}>削除</button>
    </div>
  )
}

export default function ExpensesPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const router = useRouter()
  const [caseInfo, setCaseInfo] = useState<JizokukaCase | null>(null)
  const [items, setItems] = useState<JizokukaExpenseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [rate, setRate] = useState('0.6667')
  const [cap, setCap] = useState('500000')
  const [selfFunds, setSelfFunds] = useState('')
  const [loanFunds, setLoanFunds] = useState('')
  const [otherFunds, setOtherFunds] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([fetchCaseDetail(caseId), fetchExpenseItems(caseId)]).then(([{ case: c }, expenseItems]) => {
      setCaseInfo(c)
      setItems(expenseItems)
      setRate(c.subsidy_rate?.toString() ?? '0.6667')
      setCap(c.subsidy_cap?.toString() ?? '500000')
      setSelfFunds(c.self_funds?.toString() ?? '')
      setLoanFunds(c.loan_funds?.toString() ?? '')
      setOtherFunds(c.other_funds?.toString() ?? '')
    }).finally(() => setLoading(false))
  }, [caseId])

  const handleAdd = async () => {
    const item = await addExpenseItem(caseId, items.length)
    setItems(list => [...list, item])
  }

  const handleChange = (id: string, patch: Partial<JizokukaExpenseItem>) => {
    setItems(list => list.map(i => (i.id === id ? { ...i, ...patch } : i)))
  }

  const handleDelete = async (id: string) => {
    await deleteExpenseItem(id)
    setItems(list => list.filter(i => i.id !== id))
  }

  const handleSaveFunding = async () => {
    setSaving(true)
    try {
      await updateCaseFunding(caseId, {
        subsidy_rate: Number(rate) || 0.6667,
        subsidy_cap: Number(cap) || 500000,
        self_funds: selfFunds ? Number(selfFunds) : null,
        loan_funds: loanFunds ? Number(loanFunds) : null,
        other_funds: otherFunds ? Number(otherFunds) : null,
      })
    } catch (e) {
      alert(`保存に失敗しました: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-slate-400">読み込み中…</div>

  const nonWebTotal = items.filter(i => !i.is_website_related).reduce((s, i) => s + (i.amount || 0), 0)
  const webTotal = items.filter(i => i.is_website_related).reduce((s, i) => s + (i.amount || 0), 0)
  const rateNum = Number(rate) || 0
  const capNum = Number(cap) || 0
  const grantNonWeb = Math.min(Math.floor(nonWebTotal * rateNum), capNum)
  const grantWeb = Math.min(Math.floor(webTotal * rateNum), Math.floor(grantNonWeb / 4), 500000)
  const totalExpense = nonWebTotal + webTotal
  const totalGrant = grantNonWeb + grantWeb
  const fundingTotal = totalGrant + (Number(selfFunds) || 0) + (Number(loanFunds) || 0) + (Number(otherFunds) || 0)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title={`経費明細・資金調達 — ${caseInfo?.business_name ?? ''}`}
        description="見積金額を入力すると、補助対象経費・交付申請額を自動計算します（目安。最終的な金額は電子申請ポータルで必ず確認してください）"
      >
        <button className="btn-secondary" onClick={() => router.push(`/jizokuka-pilot/cases/${caseId}/hearing`)}>
          ヒアリングへ戻る
        </button>
      </PageHeader>

      <div className="card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">経費明細表</h3>
          <button type="button" className="btn-secondary" onClick={handleAdd}>+ 経費を追加</button>
        </div>
        {items.length === 0 && <p className="text-sm text-slate-400">まだ経費が登録されていません</p>}
        {items.map(item => (
          <ExpenseRow key={item.id} item={item} onChange={handleChange} onDelete={handleDelete} />
        ))}
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">補助率・上限額</h3>
        <p className="text-xs text-slate-500 sm:col-span-2">
          通常枠は補助率2/3・上限50万円。特例（インボイス+50万円／賃金引上げ+50万円／賃金引上げ(赤字)+150万円・補助率3/4）を選んだ場合は「基本情報」ページの選択に合わせて手動で変更してください。
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">補助率</label>
          <input className="input" type="number" step="0.0001" value={rate} onChange={ev => setRate(ev.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">補助上限額（円・ウェブ除く）</label>
          <input className="input" type="number" value={cap} onChange={ev => setCap(ev.target.value)} />
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
        <h3 className="text-sm font-bold text-slate-900 sm:col-span-3">資金調達方法</h3>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">自己資金（円）</label>
          <input className="input" type="number" value={selfFunds} onChange={ev => setSelfFunds(ev.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">金融機関からの借入金（円）</label>
          <input className="input" type="number" value={loanFunds} onChange={ev => setLoanFunds(ev.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">その他（円）</label>
          <input className="input" type="number" value={otherFunds} onChange={ev => setOtherFunds(ev.target.value)} />
        </div>
        <div className="sm:col-span-3">
          <button className="btn-primary" onClick={handleSaveFunding} disabled={saving}>
            {saving ? '保存中…' : '補助率・資金調達を保存'}
          </button>
        </div>
      </div>

      <div className="card flex flex-col gap-2 p-5 text-sm">
        <h3 className="mb-1 text-sm font-bold text-slate-900">計算結果（目安）</h3>
        <div className="flex justify-between"><span>(a) 補助対象経費小計（ウェブ除く）</span><span>{formatYen(nonWebTotal)}</span></div>
        <div className="flex justify-between"><span>(b) 補助金交付申請額（ウェブ除く）</span><span>{formatYen(grantNonWeb)}</span></div>
        <div className="flex justify-between"><span>(c) ウェブサイト関連費小計</span><span>{formatYen(webTotal)}</span></div>
        <div className="flex justify-between"><span>(d) ウェブサイト関連費 交付申請額</span><span>{formatYen(grantWeb)}</span></div>
        <div className="flex justify-between border-t border-slate-100 pt-2 font-bold"><span>(e) 補助対象経費合計</span><span>{formatYen(totalExpense)}</span></div>
        <div className="flex justify-between font-bold"><span>(f) 補助金交付申請額合計</span><span>{formatYen(totalGrant)}</span></div>
        <div className="mt-2 flex justify-between border-t border-slate-100 pt-2">
          <span>資金調達合計（(f)+自己資金+借入金+その他）</span>
          <span className={fundingTotal < totalExpense ? 'text-rose-600' : 'text-slate-900'}>
            {formatYen(fundingTotal)}{fundingTotal < totalExpense && '（経費合計に不足あり）'}
          </span>
        </div>
      </div>
    </div>
  )
}
