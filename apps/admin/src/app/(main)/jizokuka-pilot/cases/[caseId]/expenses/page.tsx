'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  fetchCaseDetail, fetchBasicInfo, fetchExpenseItems, addExpenseItem, updateExpenseItem, deleteExpenseItem, updateCaseFunding,
  type JizokukaCase, type JizokukaExpenseItem,
} from '@/lib/jizokuka/db'
import { StepNav, StepTabs } from '@/components/jizokuka/step-nav'
import { buildFieldsDocxBlob, downloadBlob } from '@/lib/jizokuka/word-export'
import { calcGrant, specialRule } from '@/lib/jizokuka/grant'

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
  const [caseInfo, setCaseInfo] = useState<JizokukaCase | null>(null)
  const [items, setItems] = useState<JizokukaExpenseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [rate, setRate] = useState('0.6667')
  const [cap, setCap] = useState('500000')
  const [selfFunds, setSelfFunds] = useState('')
  const [loanFunds, setLoanFunds] = useState('')
  const [otherFunds, setOtherFunds] = useState('')
  const [saving, setSaving] = useState(false)
  const [rule, setRule] = useState<ReturnType<typeof specialRule> | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    Promise.all([fetchCaseDetail(caseId), fetchExpenseItems(caseId), fetchBasicInfo(caseId)]).then(([{ case: c }, expenseItems, basic]) => {
      setCaseInfo(c)
      setItems(expenseItems)
      const r = specialRule(basic.invoice_exception, basic.wage_increase_exception)
      setRule(r)
      let rateNow = c.subsidy_rate?.toString() ?? '0.6667'
      let capNow = c.subsidy_cap?.toString() ?? '500000'
      // 上限・補助率が初期値のままなら、基本情報の特例の選択に合わせて自動で設定・保存する
      if (Number(capNow) === 500000 && Number(rateNow) === 0.6667 && (r.cap !== 500000 || r.rate !== 0.6667)) {
        rateNow = String(r.rate)
        capNow = String(r.cap)
        updateCaseFunding(caseId, { subsidy_rate: r.rate, subsidy_cap: r.cap }).catch(() => {})
      }
      setRate(rateNow)
      setCap(capNow)
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

  const persistFunding = () => updateCaseFunding(caseId, {
    subsidy_rate: Number(rate) || 0.6667,
    subsidy_cap: Number(cap) || 500000,
    self_funds: selfFunds ? Number(selfFunds) : null,
    loan_funds: loanFunds ? Number(loanFunds) : null,
    other_funds: otherFunds ? Number(otherFunds) : null,
  })

  const handleSaveFunding = async () => {
    setSaving(true)
    try {
      await persistFunding()
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
  const prTotal = items.filter(i => !i.is_website_related && (i.category ?? '').includes('広報費')).reduce((s, i) => s + (i.amount || 0), 0)
  const { totalGrant, nonWebMin, nonWebMax, webMin, webMax } = calcGrant(nonWebTotal, webTotal, rateNum, capNum, prTotal)
  // 補助上限額に達するときは、様式3と同じく(b)(d)を範囲で表示する（合計は(f)）
  const yenRange = (lo: number, hi: number) => (lo === hi ? formatYen(lo) : `${formatYen(lo)}〜${formatYen(hi)}`)
  const grantNonWebText = yenRange(nonWebMin, nonWebMax)
  const grantWebText = yenRange(webMin, webMax)
  const totalExpense = nonWebTotal + webTotal
  const fundingTotal = totalGrant + (Number(selfFunds) || 0) + (Number(loanFunds) || 0) + (Number(otherFunds) || 0)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const blob = await buildFieldsDocxBlob(`${caseInfo?.business_name ?? '申請書'} 経費明細・資金調達`, [
        {
          heading: '経費明細表',
          fields: items.map((item, i) => ({
            label: `${i + 1}. ${item.category ?? '（未選択）'}`,
            value: `${item.description ?? ''}（${formatYen(item.amount || 0)}）`,
          })),
        },
        {
          heading: '補助率・上限額',
          fields: [
            { label: '補助率', value: rate },
            { label: '補助上限額（円・ウェブサイト関連費を含む合計）', value: cap },
          ],
        },
        {
          heading: '資金調達方法',
          fields: [
            { label: '自己資金（円）', value: selfFunds },
            { label: '金融機関からの借入金（円）', value: loanFunds },
            { label: 'その他（円）', value: otherFunds },
          ],
        },
        {
          heading: '計算結果（目安）',
          fields: [
            { label: '(a) 補助対象経費小計（ウェブ除く）', value: formatYen(nonWebTotal) },
            { label: '(b) 補助金交付申請額（ウェブ除く）', value: grantNonWebText },
            { label: '(c) ウェブサイト関連費小計', value: formatYen(webTotal) },
            { label: '(d) ウェブサイト関連費 交付申請額', value: grantWebText },
            { label: '(e) 補助対象経費合計', value: formatYen(totalExpense) },
            { label: '(f) 補助金交付申請額合計', value: formatYen(totalGrant) },
            { label: '資金調達合計', value: formatYen(fundingTotal) },
          ],
        },
      ])
      downloadBlob(blob, `${caseInfo?.business_name ?? '申請書'}_経費明細.docx`)
    } catch {
      alert('Wordファイルの作成に失敗しました')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <StepTabs caseId={caseId} current="expenses" onSave={persistFunding} />
      <PageHeader
        title={`経費明細・資金調達 — ${caseInfo?.business_name ?? ''}`}
        description="見積金額を入力すると、補助対象経費・交付申請額を自動計算します（目安。最終的な金額は電子申請ポータルで必ず確認してください）"
      >
        <StepNav onSave={persistFunding} />
        <button className="btn-secondary" onClick={handleDownload} disabled={downloading}>
          {downloading ? '作成中…' : 'Wordでダウンロード'}
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
          通常枠は補助率2/3・上限50万円（補助金交付申請額の合計の上限）。広報費・ウェブサイト関連費は、それぞれ交付申請額の上限が30万円です。特例（インボイス+50万円／賃金引上げ+150万円／両方+200万円。賃金引上げのうち赤字事業者は補助率3/4）を選んだ場合は「基本情報」ページの選択に合わせて手動で変更してください。
        </p>
        {rule && (Number(cap) !== rule.cap || Number(rate) !== rule.rate) && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 sm:col-span-2">
            <span>基本情報の選択（{rule.label}）では、補助上限額は{rule.cap.toLocaleString()}円・補助率は{rule.rate}です。</span>
            <button type="button" className="btn-secondary text-xs" onClick={() => { setCap(String(rule.cap)); setRate(String(rule.rate)) }}>
              基本情報に合わせる
            </button>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">補助率</label>
          <input className="input" type="number" step="0.0001" value={rate} onChange={ev => setRate(ev.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">補助上限額（円・ウェブサイト関連費を含む合計）</label>
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
        <div className="flex justify-between"><span>(b) 補助金交付申請額（ウェブ除く）</span><span>{grantNonWebText}</span></div>
        <div className="flex justify-between"><span>(c) ウェブサイト関連費小計</span><span>{formatYen(webTotal)}</span></div>
        <div className="flex justify-between"><span>(d) ウェブサイト関連費 交付申請額</span><span>{grantWebText}</span></div>
        <div className="flex justify-between border-t border-slate-100 pt-2 font-bold"><span>(e) 補助対象経費合計</span><span>{formatYen(totalExpense)}</span></div>
        <div className="flex justify-between font-bold"><span>(f) 補助金交付申請額合計</span><span>{formatYen(totalGrant)}</span></div>
        {(nonWebMin !== nonWebMax || webMin !== webMax) && (
          <p className="text-xs text-slate-500">
            補助上限額に達するため、(b)と(d)は範囲で表示しています。合計が(f)になるように、配分を選んで電子申請に入力してください（様式3の判定式と同じです）。
          </p>
        )}
        {nonWebTotal === 0 && webTotal > 0 && (
          <p className="text-rose-600">ウェブサイト関連費のみでの申請はできません（ほかの経費と一緒に申請してください）</p>
        )}
        <div className="mt-2 flex justify-between border-t border-slate-100 pt-2">
          <span>資金調達合計（(f)+自己資金+借入金+その他）</span>
          <span className={fundingTotal !== totalExpense ? 'text-rose-600' : 'text-slate-900'}>
            {formatYen(fundingTotal)}
            {fundingTotal < totalExpense && '（経費合計に不足あり）'}
            {fundingTotal > totalExpense && '（経費合計を超えています）'}
          </span>
        </div>
        {fundingTotal !== totalExpense && (
          <p className="text-xs text-rose-600">
            資金調達合計は、(e) 補助対象経費合計と一致させてください。自己資金の目安は {formatYen(Math.max(0, totalExpense - totalGrant - (Number(loanFunds) || 0) - (Number(otherFunds) || 0)))}
            （＝(e) − (f) − 借入金 − その他）です。
          </p>
        )}
      </div>
    </div>
  )
}
