'use client'

import { PageHeader } from '@/components/layout/PageHeader'

const SECTIONS: { title: string; target: string; questions: string[] }[] = [
  {
    title: '① 会社の基本情報',
    target: '→「基本情報」画面に入力',
    questions: [
      '正式な会社名・屋号、代表者のお名前と役職を教えてください。',
      '本店の住所・電話番号を教えてください（名刺や登記簿があると確実です）。',
      '資本金と設立年月日を教えてください。',
      '現在の従業員数を教えてください。',
      'ホームページをお持ちでしたら、URLを教えてください。',
      '商工会・商工会議所には加入されていますか？',
    ],
  },
  {
    title: '② 事業の内容と業績',
    target: '→「基本情報」「ヒアリング」画面に入力',
    questions: [
      'どんな事業をされていますか？（業種、主な商品・サービスの内容）',
      '直近1年間の決算では、売上・利益はどれくらいでしたか？（決算書があれば数字を確認させてください）',
    ],
  },
  {
    title: '③ 自社の強み・弱み',
    target: '→「ヒアリング」画面に入力（AIが下書きする材料になります）',
    questions: [
      '他社と比べて、御社の強みは何だと思いますか？（技術力、立地、ブランド、価格、実績など）',
      '逆に、課題だと感じている点や弱みはありますか？',
      '競合の状況や市場で気になっている変化（向かい風）はありますか？',
      '逆に、追い風だと感じている変化（チャンス）はありますか？',
    ],
  },
  {
    title: '④ 市場・顧客について',
    target: '→「ヒアリング」画面に入力',
    questions: [
      'どんなお客様が多いですか？（年齢層・地域・法人か個人かなど）',
      '最近、お客様のニーズや業界の動向で変わってきたと感じることはありますか？',
    ],
  },
  {
    title: '⑤ 経営方針・今後の展望',
    target: '→「ヒアリング」画面に入力',
    questions: [
      '今後、会社としてどの方向に進みたいと考えていますか？',
      '具体的な数値目標（売上・客数など）はありますか？',
      'その目標を達成するために、今考えている取り組み・プランはありますか？',
    ],
  },
  {
    title: '⑥ 今回の補助事業でやりたいこと',
    target: '→「ヒアリング」画面に入力',
    questions: [
      '今回の補助金で、具体的に何を実施したいですか？（設備導入、ホームページ制作、広告、新商品開発など）',
      'なぜそれが必要だと思いましたか？（③④の課題とのつながりを意識して聞く）',
      'それによって、売上や利益にどうつながると考えていますか？',
      'いつ頃までに実施したいですか？',
    ],
  },
  {
    title: '⑦ 経費・お金まわり',
    target: '→「経費明細・資金調達」画面に入力',
    questions: [
      '実施したいことについて、業者から見積もりはもらっていますか？もらっていなければ、依頼できそうですか？',
      'だいたいの予算感（総額）はありますか？',
      '自己資金でまかなえる部分、金融機関からの借入を考えている部分はありますか？',
    ],
  },
  {
    title: '⑧ 必要書類の確認（このツールでは作れないもの）',
    target: '→ 電子申請ポータルへ直接アップロード',
    questions: [
      '直近の決算書（貸借対照表・損益計算書）はすぐに用意できますか？',
      '賃金台帳や、雇用条件（労働時間・休日）が分かる書類はありますか？',
      '（賃金引上げ特例を希望する場合）対象になる従業員の方の氏名・賃金体系が分かりますか？',
    ],
  },
]

export default function HearingSheetPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 print:p-0">
      <PageHeader
        title="初回ヒアリングシート"
        description="面談でこの順番に聞けば、申請書ドラフト作成に必要な情報がひと通り揃います。印刷して持参してもOKです。"
      />

      <div className="flex flex-col gap-4">
        {SECTIONS.map(section => (
          <div key={section.title} className="card p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
              <span className="text-xs text-slate-400">{section.target}</span>
            </div>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
              {section.questions.map((q, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" />
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 print:hidden">
        ※ 聞いた内容はそのまま「基本情報」「ヒアリング」「経費明細・資金調達」の各画面に入力してください。
        入力後は「保存してAI下書きを生成」で経営計画・補助事業計画の文章が自動で作成されます。
      </p>
    </div>
  )
}
