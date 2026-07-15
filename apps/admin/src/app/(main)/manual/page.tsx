'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/hooks/useAuth'

/* ─── 権限（ロール）の概要 ─────────────────────────── */
const ROLES = [
  {
    key: 'admin',
    label: '管理者',
    cls: 'bg-brand-100 text-brand-700',
    ring: 'ring-brand-200',
    who: '経営・システム管理者',
    summary: 'すべての機能を利用でき、メンバーの追加・停止・権限変更ができます。',
  },
  {
    key: 'manager',
    label: 'マネージャー',
    cls: 'bg-indigo-100 text-indigo-700',
    ring: 'ring-indigo-200',
    who: '営業リーダー・管理職',
    summary: '全メンバーの顧客・案件・タスク・実績を見て、割り当てや削除ができます。',
  },
  {
    key: 'staff',
    label: '一般',
    cls: 'bg-slate-100 text-slate-600',
    ring: 'ring-slate-200',
    who: '各担当者',
    summary: '自分の担当している顧客・案件・タスクを中心に利用できます。',
  },
] as const

/* ─── 権限マトリクス ───────────────────────────────── */
type Cell = { s: '○' | '△' | '×'; note?: string }
const MATRIX: { feature: string; admin: Cell; manager: Cell; staff: Cell }[] = [
  { feature: '顧客・案件を見る',
    admin: { s: '○', note: '全件' }, manager: { s: '○', note: '全件' }, staff: { s: '△', note: '自分の担当のみ' } },
  { feature: '顧客・案件を追加する',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '○' } },
  { feature: '顧客・案件を削除する',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '×' } },
  { feature: 'タスクを見る',
    admin: { s: '○', note: '全員分' }, manager: { s: '○', note: '全員分' }, staff: { s: '△', note: '自分＋共有分' } },
  { feature: 'タスクを他の人に割り当て・LINE通知',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '×' } },
  { feature: '受信トレイの対応（既読・返信済み）',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '○' } },
  { feature: '受信トレイのメッセージを消す',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '×' } },
  { feature: '予定を追加する',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '○' } },
  { feature: '他の人の予定を編集・削除',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '△', note: '自分の予定のみ' } },
  { feature: '実績・売上目標を見る',
    admin: { s: '○', note: '全体' }, manager: { s: '○', note: '全体' }, staff: { s: '△', note: '自分中心' } },
  { feature: 'メンバーの招待・停止・権限変更',
    admin: { s: '○' }, manager: { s: '×' }, staff: { s: '×' } },
  { feature: 'LINE朝配信のON/OFF切替',
    admin: { s: '○' }, manager: { s: '×' }, staff: { s: '×' } },
  { feature: '設定ページ（プロフィール・通知・連携）',
    admin: { s: '○' }, manager: { s: '×' }, staff: { s: '×' } },
]

const CELL_CLS: Record<Cell['s'], string> = {
  '○': 'text-emerald-600',
  '△': 'text-amber-600',
  '×': 'text-slate-300',
}

/* ─── 各機能の使い方 ───────────────────────────────── */
const GUIDES: { title: string; badge?: string; steps: string[] }[] = [
  {
    title: 'ダッシュボード',
    steps: [
      'ログインすると最初に開く画面です。案件・タスク・問い合わせなど全体の状況をひと目で確認できます。',
      '左のメニューから各機能へ移動します。',
    ],
  },
  {
    title: '顧客管理',
    steps: [
      '取引先の会社を一覧・検索できます。会社名や担当者名で絞り込み、業種・ステータスでも絞れます。',
      '「＋顧客を追加」で新規登録（会社名・担当者・電話・業種・従業員数・ステータス）。',
      '行をクリックすると詳細ページが開き、社内担当・関連資料（Drive）を確認できます。',
      '※ 一般権限では自分が担当する顧客のみ表示されます。',
    ],
  },
  {
    title: '案件管理',
    steps: [
      '補助金の申請案件を管理します。ステータスは 準備中 → 申請準備中 → 申請済み → 採択／不採択 → 完了 と進みます。',
      '各案件に「申請額・採択額・着手金・成功報酬率」を入力しておくと、実績や売上の集計に反映されます。',
      '「＋案件を追加」で登録。行クリックで詳細（担当・資料・メモ）。',
      '※ 削除は管理者・マネージャーのみ可能です。',
    ],
  },
  {
    title: '補助金管理',
    steps: [
      '取り扱う補助金の情報を一覧で確認できます。',
      '案件を作るときの参照用としてご利用ください。',
    ],
  },
  {
    title: 'タスク管理',
    steps: [
      '「未着手／進行中／完了」の3列（カンバン）でタスクを管理します。',
      '「＋タスクを追加」でタスク名・内容メモ・優先度・期限・関連案件を登録できます。',
      '各カードの ← → ボタンで列を移動、完了したカードは × で削除できます。',
      '管理者・マネージャーは、担当者を選んで他の人に割り当て、その場で本人にLINE通知を送れます。',
      '上部の担当者フィルタで、特定メンバーのタスクだけを表示できます。',
    ],
  },
  {
    title: '受信トレイ',
    steps: [
      'LINE・メール・Webフォームからの問い合わせが1か所に集まります。',
      'クリックで既読になります。「要返信」バッジのものは、対応後に「返信済みにする」を押します。',
      '不要なメッセージは「消す」で削除できます。削除はPC・スマホどちらで行っても両方に反映されます。',
      'スマホでは、メッセージを左にスワイプすると消せます。',
      '※ メッセージの削除は管理者・マネージャーのみ可能です。',
    ],
  },
  {
    title: 'スケジュール',
    steps: [
      'チームの予定をカレンダーで確認できます。Googleカレンダーと連携して同期できます（設定 → 連携サービス）。',
      '「商談」の予定を登録すると、実績ページの商談件数に自動でカウントされます。',
      '※ 他の人の予定の編集・削除は管理者・マネージャーのみ。自分の予定は本人が編集できます。',
    ],
  },
  {
    title: '実績・売上目標',
    badge: '一部準備中',
    steps: [
      '月ごとに、メンバー別の「商談 → 受注 → 採択金額」を集計して表示します。上部の ‹ › で月を切り替えます。',
      '会社全体の収支目標や、メンバー別の補助金獲得目標を確認できるよう拡張予定です。',
      '目標金額は管理者が入力し、実績・見込みは案件データから自動集計されます。',
    ],
  },
  {
    title: '設定（管理者のみ）',
    badge: '管理者限定',
    steps: [
      'プロフィール：氏名・部署の変更。',
      'メンバー管理：メンバーの招待（仮パスワード発行）、停止／復帰、権限変更、朝のLINE配信ON/OFF。',
      '通知設定：期限アラートや週次サマリーなどの受け取り設定。',
      'セキュリティ：自分のパスワード変更。',
      '連携サービス：Googleカレンダー連携の接続／解除。',
    ],
  },
  {
    title: '社内フォルダ',
    steps: [
      'メニューの「社内フォルダ」から、会社共有のGoogle Drive（社内ノウハウ・資料）を新しいタブで開きます。',
    ],
  },
]

export default function ManualPage() {
  const { role } = useAuth()
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="マニュアル" description="各機能の使い方と、権限（管理者・マネージャー・一般）の違い" />

      {/* ログイン・基本 */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-slate-800">はじめに（ログイン）</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>・ ログインURL：<span className="font-medium text-brand-700">https://salud-admin-azure.vercel.app</span></li>
          <li>・ ID は<b>メールアドレス</b>、パスワードは管理者から配布された仮パスワードです（大文字・小文字は区別されます）。</li>
          <li>・ スマホでも同じURL・同じIDで入れます。ログイン状態は保持されます。</li>
          <li>・ パスワードを忘れたら、ログイン画面の「パスワードをお忘れの方はこちら」から再設定できます。</li>
        </ul>
      </section>

      {/* 権限の違い */}
      <section className="flex flex-col gap-4">
        <h2 className="px-1 text-sm font-bold text-slate-800">権限（ロール）の違い</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ROLES.map(r => (
            <div
              key={r.key}
              className={`card p-4 ${role === r.key ? `ring-2 ${r.ring}` : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`badge text-xs ${r.cls}`}>{r.label}</span>
                {role === r.key && <span className="text-xs font-medium text-brand-600">あなた</span>}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">{r.who}</p>
              <p className="mt-1 text-sm text-slate-600">{r.summary}</p>
            </div>
          ))}
        </div>

        {/* マトリクス */}
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-3 text-left font-medium">できること</th>
                <th className="px-3 py-3 text-center font-medium">管理者</th>
                <th className="px-3 py-3 text-center font-medium">マネージャー</th>
                <th className="px-3 py-3 text-center font-medium">一般</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(row => (
                <tr key={row.feature} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{row.feature}</td>
                  {([row.admin, row.manager, row.staff]).map((c, i) => (
                    <td key={i} className="px-3 py-2.5 text-center">
                      <span className={`text-base font-bold ${CELL_CLS[c.s]}`}>{c.s}</span>
                      {c.note && <span className="mt-0.5 block text-[10px] leading-tight text-slate-400">{c.note}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-1 text-xs text-slate-400">
          <span className="font-bold text-emerald-600">○</span> 利用可 ／
          <span className="font-bold text-amber-600"> △</span> 自分の担当・自分の分のみ ／
          <span className="font-bold text-slate-400"> ×</span> 利用不可
        </p>
      </section>

      {/* 各機能の使い方 */}
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold text-slate-800">各機能の使い方</h2>
        {GUIDES.map((g, i) => {
          const isOpen = open === i
          return (
            <div key={g.title} className="card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-semibold text-slate-800">{g.title}</span>
                {g.badge && (
                  <span className="badge bg-amber-100 text-xs text-amber-700">{g.badge}</span>
                )}
                <svg
                  className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <ul className="space-y-2 border-t border-slate-50 px-4 py-3.5 pl-5 text-sm leading-relaxed text-slate-600">
                  {g.steps.map((s, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </section>

      <p className="text-xs text-slate-400">
        ※ 操作で困ったことや「こうしたい」があれば、管理者までお知らせください。マニュアルは随時更新します。
      </p>
    </div>
  )
}
