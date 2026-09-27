'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

const GUIDES: { title: string; steps: string[] }[] = [
  {
    title: '①案件一覧',
    steps: [
      '「持続化パイロット」を開くと最初に出る画面です。今までに作った案件（事業者ごとの申請準備）が並びます。',
      '「＋新規案件を作成」から、事業者名・代表者・申請期限を入力すると新しい案件ができ、そのまま基本情報の入力画面に進みます。',
    ],
  },
  {
    title: '②基本情報（会社登記情報・応募者概要）',
    steps: [
      '電子申請ポータルの「申請情報」「基本情報」「応募者の概要」「確認事項」「希望する特例」にあたる項目を入力します。',
      '既にSaludの顧客管理に登録済みの会社なら、「顧客管理から自動反映」で選ぶと、会社名カナ・業種・電話番号・住所・担当者情報を自動でコピーできます（その後も自由に直せます）。',
      '住所・電話番号・法人番号など、会社の登記情報をそのまま転記する項目が中心です。AIが考えて書く部分ではありません。',
    ],
  },
  {
    title: '③ヒアリング',
    steps: [
      '業種・従業員数・売上、会社の強み弱み、市場の動向、経営方針などをスタッフが聞き取って入力する画面です。',
      'ここで入力した内容をもとに、AIが経営計画・補助事業計画の文章を下書きします。',
      '「一時保存（後で続きから入力）」であとで続きから入力できます。すべて入力できたら「保存してAI下書きを生成」を押すと、AIが13項目の文章を一括で作成し、レビュー画面に進みます（数十秒かかります）。',
    ],
  },
  {
    title: '④経費明細・資金調達',
    steps: [
      '補助事業で使う予定の経費を1件ずつ追加します（経費区分・内容・金額）。金額は業者に確認した見積もりをそのまま入力してください（AIは金額を考えたり調べたりできません）。',
      '「補助率・上限額」は通常枠なら2/3・50万円です。インボイス特例や賃金引上げ特例を選んでいる場合は、基本情報ページでの選択に合わせて数字を書き換えてください。',
      '自己資金・借入金・その他を入力すると、経費合計に対して資金が足りているかも一目で分かります。',
      '入力すると、補助対象経費や交付申請額の見込み金額が自動で計算されます。ただしあくまで目安なので、最終的な金額は電子申請ポータル上で必ず確認してください。',
    ],
  },
  {
    title: '⑤レビュー',
    steps: [
      'AIが作った文章を1項目ずつ確認します。',
      '文章はそのまま書き換えて保存もできますし、「修正指示」欄に「もっと具体的に」のようにお願いを書いて「AIで再生成」を押すと、その部分だけAIに書き直させることもできます。',
      'すべて確認できたら「確定してエクスポートへ」でエクスポート画面に進みます。',
    ],
  },
  {
    title: '⑥エクスポート',
    steps: [
      '完成した文章を、電子申請ポータルにそのまま貼り付けられる形で確認できます。',
      '「コピー」ボタンで1項目ずつ、「全文をコピー」で全部まとめてコピーできます。',
      '「Wordでダウンロード」を押すと、同じ内容がWordファイル（.docx）として保存されます。クライアントへメールで送る場合や、印刷して確認してもらう場合に使ってください。',
      '基本情報・ヒアリング・経費明細の各画面にも、それぞれ「Wordでダウンロード」ボタンがあります。',
    ],
  },
]

export default function JizokukaGuidePage() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="持続化パイロット ガイド" description="小規模事業者持続化補助金の申請準備を手伝うAIツールです（社内テスト中）" />

      <section className="card p-5">
        <h2 className="text-sm font-bold text-slate-800">これは何のツール？</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          小規模事業者持続化補助金の申請で一番時間がかかる「経営計画書・補助事業計画書」の文章づくりを、
          ヒアリング内容をもとにAIが下書きしてくれるツールです。会社の基本情報の入力や、経費の金額計算も手伝います。
          <br />
          ただし、これはあくまで<b>下書き・準備の手助け</b>です。最終的な申請の提出は、これまでどおり本物の電子申請ポータル
          （jizokuka-portal.info）で行ってください。
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-sm font-bold text-emerald-700">できること</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
            <li>・ ヒアリング内容から、経営計画・補助事業計画の文章（13項目）を自動で下書き</li>
            <li>・ 気に入らない部分は、指示を出してAIに書き直させたり、自分で直接編集したりできる</li>
            <li>・ 電子申請ポータルと同じ項目（基本情報・応募者概要・確認事項など）の入力欄</li>
            <li>・ 経費を入力すると、補助金の交付申請額などを自動計算</li>
            <li>・ 各パートをWordファイルでダウンロードして、メール添付や印刷に使える</li>
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="text-sm font-bold text-amber-700">できないこと（自分で用意するもの）</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
            <li>・ 経費の見積もり金額そのもの（実際に業者へ確認した金額を入力する必要があります）</li>
            <li>・ 決算書・賃金台帳・雇用条件の書類や、商工会議所発行の様式4（アップロード非対応）</li>
            <li>・ 従業員ごとの最低賃金の計算表</li>
            <li>・ グラフや図（市場データのグラフなど）。必要な場合は自分で用意し、実際のポータルや別添資料に貼り付けてください</li>
            <li>・ 電子申請ポータルへの最終的な入力・提出（このツールは下書き・準備専用です）</li>
          </ul>
        </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold text-slate-800">使い方の流れ</h2>
        {GUIDES.map((g, i) => {
          const isOpen = open === i
          return (
            <div key={g.title} className="card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="flex-1 text-sm font-semibold text-slate-800">{g.title}</span>
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
        ※ 各画面の上部にあるタブから、いつでも他のパートへ移動できます（移動前に自動で保存されます）。
        まだ社内テスト中の機能です。使ってみて気づいたこと・こうしてほしいことがあれば教えてください。
      </p>
    </div>
  )
}
