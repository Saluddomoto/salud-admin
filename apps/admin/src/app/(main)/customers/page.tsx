'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { mockCustomers } from '@/lib/mock-data'

const STATUS_LABELS = {
  active:   { label: '契約中', cls: 'bg-emerald-100 text-emerald-700' },
  prospect: { label: '見込み', cls: 'bg-amber-100 text-amber-700' },
  inactive: { label: '休眠',   cls: 'bg-slate-100 text-slate-500' },
} as const

export default function CustomersPage() {
  const [search,   setSearch]   = useState('')
  const [industry, setIndustry] = useState('')
  const [status,   setStatus]   = useState('')

  const industries = [...new Set(mockCustomers.map(c => c.industry))]

  const filtered = mockCustomers.filter(c => {
    if (search && !`${c.companyName}${c.contactName}`.includes(search)) return false
    if (industry && c.industry !== industry) return false
    if (status && c.status !== status) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="顧客管理" description={`全 ${mockCustomers.length} 社`}>
        <button className="btn-secondary text-sm">CSVエクスポート</button>
        <button className="btn-primary text-sm">+ 顧客を追加</button>
      </PageHeader>

      {/* フィルター */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input
          className="input max-w-xs"
          placeholder="会社名・担当者名で検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input w-40" value={industry} onChange={e => setIndustry(e.target.value)}>
          <option value="">全業種</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select className="input w-40" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">全ステータス</option>
          <option value="active">契約中</option>
          <option value="prospect">見込み</option>
          <option value="inactive">休眠</option>
        </select>
        <span className="ml-auto text-sm text-slate-500">{filtered.length} 件</span>
      </div>

      {/* テーブル */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">会社名</th>
              <th className="px-4 py-3 font-medium">担当者</th>
              <th className="px-4 py-3 font-medium">業種</th>
              <th className="px-4 py-3 font-medium">従業員数</th>
              <th className="px-4 py-3 font-medium">ステータス</th>
              <th className="px-4 py-3 font-medium">社内担当</th>
              <th className="px-4 py-3 font-medium">最終接触</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const st = STATUS_LABELS[c.status]
              return (
                <tr key={c.id} className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{c.companyName}</p>
                    <p className="text-xs text-slate-400">{c.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.contactName}</td>
                  <td className="px-4 py-3 text-slate-700">{c.industry}</td>
                  <td className="px-4 py-3 text-slate-700">{c.employeeCount}名</td>
                  <td className="px-4 py-3"><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3 text-slate-700">{c.assignee}</td>
                  <td className="px-4 py-3 text-slate-500">{c.lastContact}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  該当する顧客がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
