import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'

// 持続化パイロットの操作マニュアル（社内スタッフ向け）。
// 画面・ボタンの名称を変えたときは、ここも合わせて直す。

type Lane = 'client' | 'staff' | 'system'

const LANES: { key: Lane; label: string; y: number; bg: string; stroke: string; badge: string }[] = [
  { key: 'client', label: 'クライアント', y: 20, bg: 'fill-amber-50', stroke: 'stroke-amber-600', badge: 'bg-amber-500' },
  { key: 'staff', label: 'スタッフ', y: 140, bg: 'fill-brand-50', stroke: 'stroke-brand-600', badge: 'bg-brand-600' },
  { key: 'system', label: 'システム・AI', y: 260, bg: 'fill-emerald-50', stroke: 'stroke-emerald-600', badge: 'bg-emerald-600' },
]
const laneOf = (k: Lane) => LANES.find(l => l.key === k)!

const FLOW: { n: string; t: string; lane: Lane }[] = [
  { n: '①', t: '案件を作成', lane: 'staff' },
  { n: '②', t: 'シートを送る', lane: 'staff' },
  { n: '③', t: '記入して返送', lane: 'client' },
  { n: '④', t: 'シートを反映', lane: 'staff' },
  { n: '⑤', t: '自動で入力', lane: 'system' },
  { n: '⑥', t: '不足を補う', lane: 'staff' },
  { n: '⑦', t: '下書きを生成', lane: 'system' },
  { n: '⑧', t: 'レビュー・修正', lane: 'staff' },
  { n: '⑨', t: '提出用にコピー', lane: 'staff' },
]
const cx = (i: number) => 166 + 124 * i
const cy = (lane: Lane) => laneOf(lane).y + 55

function FlowDiagram() {
  return (
    <svg
      viewBox="0 0 1240 392"
      role="img"
      aria-label="案件の作成から提出用テキストのコピーまでの9ステップ。クライアントが記入して返送した後、スタッフがシートを反映し、システムが自動入力し、AIが下書きを生成する"
      className="block h-auto w-full min-w-[860px]"
    >
      <defs>
        <marker id="mf-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-slate-500" />
        </marker>
        <marker id="mf-ahl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-brand-600" />
        </marker>
      </defs>
      {LANES.map(l => (
        <g key={l.key}>
          <rect x={0} y={l.y} width={1240} height={110} rx={8} className={l.bg} />
          <text x={14} y={l.y + 59} className="fill-slate-500 text-[12px] font-bold">{l.label}</text>
        </g>
      ))}
      {FLOW.slice(0, -1).map((s, i) => {
        const next = FLOW[i + 1]
        if (!next) return null
        const x1 = cx(i) + 52
        const x2 = cx(i + 1) - 52
        const y1 = cy(s.lane)
        const y2 = cy(next.lane)
        const d = y1 === y2 ? `M${x1} ${y1} H${x2}` : `M${x1} ${y1} H${x1 + 10} V${y2} H${x2}`
        return <path key={i} d={d} fill="none" strokeWidth={1.5} className="stroke-slate-500" markerEnd="url(#mf-ah)" />
      })}
      <path d="M1034 223 V360 H910 V343" fill="none" strokeWidth={1.5} strokeDasharray="5 4" className="stroke-brand-600" markerEnd="url(#mf-ahl)" />
      <text x={972} y={352} textAnchor="middle" className="fill-brand-600 text-[12px]">指示して再生成</text>
      {FLOW.map((s, i) => {
        const l = laneOf(s.lane)
        const y = cy(s.lane)
        return (
          <g key={s.n}>
            <rect x={cx(i) - 52} y={y - 28} width={104} height={56} rx={8} strokeWidth={1.6} className={`fill-white ${l.stroke}`} />
            <text x={cx(i)} y={y - 10} textAnchor="middle" className="fill-slate-400 text-[11px]">{s.n}</text>
            <text x={cx(i)} y={y + 10} textAnchor="middle" className="fill-slate-800 text-[12.5px] font-medium">{s.t}</text>
          </g>
        )
      })}
    </svg>
  )
}

const STEPS: { n: number; lane: Lane; who: string; title: string; items: string[]; note?: string; warn?: string }[] = [
  {
    n: 1, lane: 'staff', who: 'スタッフ ／ 案件一覧', title: '案件を作成する',
    items: [
      '持続化パイロットの案件一覧を開き、「＋ 新規案件を作成」を押します。',
      '事業者名・代表者・申請期限を入力して「作成してヒアリングへ」を押します。',
      '似た案件がある場合は、一覧の「複製」で、ヒアリング・基本情報・経費・下書きごとコピーして始められます。',
    ],
  },
  {
    n: 2, lane: 'staff', who: 'スタッフ → クライアント', title: 'ヒアリングシートを送る',
    items: [
      '最新のヒアリングシート（v3.1）をクライアントに共有します。タブは4つです。',
      '「１．基本情報」：会社情報、連絡担当者、過去3年の業績、申請類型・加点、課税区分、実施場所',
      '「2.現状分析」：主力サービス、顧客層、こだわり、課題、プラスとマイナスの動向',
      '「3.今後の事業について」：補助金でやりたいこと（経費）、売上の見込み、こだわりポイント',
      '「4.補足情報」：実施時期、業務効率化、受注・集客の状況、利益率の目標、代表者の経歴・沿革、市場の出典、顧客例・実績、載せたい資料',
    ],
  },
  {
    n: 3, lane: 'client', who: 'クライアント', title: 'シートに記入して返送する',
    items: [
      '分かる範囲で記入してもらいます。該当しない項目は空欄で構いません。',
      '数字は半角、金額は円単位です。選択式の欄（✔・経費区分・はい／いいえ）は、プルダウンや✔で入力します。',
      '「4.補足情報」が空欄だと、あとでAI下書きに「【要確認】」が増えます。できるだけ記入してもらいます。',
    ],
  },
  {
    n: 4, lane: 'staff', who: 'スタッフ ／ 案件の「基本情報」または「ヒアリング」画面', title: '返送されたシートを反映する',
    items: [
      '返送されたシートを .xlsx で保存します。Googleスプレッドシートなら「ファイル → ダウンロード → Microsoft Excel」です。',
      '案件を開き、右上の「ヒアリングシートを反映」を押して、保存したファイルを選びます。',
      '確認ダイアログに、反映される件数（基本情報○項目・ヒアリング○項目・経費○件）が出ます。内容を見て「OK」にします。',
      'シートの事業者名と案件の事業者名が違うときは、案件の名前をシートに合わせるか聞かれます。同じ会社なら「OK」にします。',
      '最後に「続けてAIで申請書用の下書きに肉付けしますか？」と聞かれます。⑥で不足を補ってから生成するなら、いったん「キャンセル」にします。',
    ],
    note: 'シートに記入のある項目だけが上書きされ、空欄の項目は今の入力が残ります。経費明細は既存の行の後ろに追加されるので、同じシートを2回取り込むと経費が重複します。',
  },
  {
    n: 5, lane: 'system', who: 'システム（自動）', title: '3つの画面に自動で入力される',
    items: ['操作は不要です。反映先は、下の「シートの反映先」の表のとおりです。'],
  },
  {
    n: 6, lane: 'staff', who: 'スタッフ ／ 「基本情報」「ヒアリング」「経費明細」画面', title: '内容を確認し、不足を補う',
    items: [
      '反映された内容を、各画面で見直します。誤りや空欄は、その場で直せます。',
      '「ヒアリング」画面の（4）補足情報と、（5）〜（7）は、AIが具体的な文章を書くための材料です。実施時期・導入する機械の品目・現在の作業の非効率な点などを埋めると、下書きの質が上がります。',
    ],
  },
  {
    n: 7, lane: 'system', who: 'AI ／ 「ヒアリング」画面', title: 'AI下書きを生成する',
    items: [
      '「保存してAI下書きを生成」を押します。数十秒から数分かかります。終わるとレビュー画面に移ります。',
      '通常は16セクション、業務効率化の取組がある事業では20セクションが作られます。',
    ],
    note: '業務効率化（3-1・3-2）は、経費に機械装置・ソフトウェア・設備などがあるとき、またはヒアリングの（4）で「導入する」を選んだときに作られます。ウェブ制作や広告だけの案件では作られません。',
  },
  {
    n: 8, lane: 'staff', who: 'スタッフ ／ 「レビュー」画面', title: '下書きを確認して直す',
    items: [
      '各セクションに修正の指示を書くと、そのセクションだけAIが書き直します。',
      '「審査基準チェック」で、審査の4つの観点（経営状況分析の妥当性／経営方針・プランの適切性／補助事業計画の有効性／積算の適切性）を、「十分・やや不足・不足」で確認できます。',
      '入力を足したくなったら、ヒアリング画面に戻って内容を直し、もう一度生成できます（下書きは新しく作り直されます）。',
    ],
  },
  {
    n: 9, lane: 'staff', who: 'スタッフ ／ 「エクスポート」画面', title: '電子申請システムに入力する',
    items: [
      'セクションごとの「コピー」、「全文をコピー」、「Wordでダウンロード」で取り出します。',
      '電子申請システム（jizokuka-portal.info、GビズIDでログイン）の入力欄に貼り付けます。',
      '電子申請システムの入力欄の文字数の上限は、公募の受付が始まってから実際の画面で確認してください。',
    ],
    warn: '赤字のセクション（「追加項目」バッジ）は、採択申請書の構成に合わせて追加した項目です。本文中の【要確認：…】は、ヒアリングで情報が足りなかった箇所です。提出前に必ず確認し、本文に書き直して「【要確認】」の文字を消してください。赤字は画面の表示だけで、コピーされる文字は色のない普通のテキストです。',
  },
]

const SCOPE_OK_AI: string[] = [
  '【経営計画書】1-1 自社の概要／1-3 経営課題／2-1 市場の動向／2-2 顧客ニーズ／3 自社の強み・弱み／4-1 経営方針・目標／4-2 今後のプラン',
  '【補助事業計画書】1 事業名／2-1 事業の概要／2-2 背景・目的／2-3 具体的な取組（概要・詳細・スケジュール）／4-1 取組の効果／4-2 効果の試算',
  '【補助事業計画書】3 業務効率化の取組（背景・目的、概要・詳細、スケジュール）。機械装置・ソフトウェア等を導入する事業のみ',
]
const SCOPE_OK_INPUT: string[] = [
  '基本情報（申請情報・会社情報・応募者の概要・担当者）：ヒアリングシートの取込と手入力で整理します',
  '経費明細と補助額の見込み計算、資金調達の整理：金額は入力した見積もりのとおりに計算します',
  'Wordファイル：申請書の下書き、ヒアリング内容、基本情報、経費明細のそれぞれ',
  'コピー用テキスト：電子申請システムへ貼り付けられる形（セクションごと・全文）',
]
const SCOPE_NG: string[] = [
  '決算書・確定申告書・見積書・登記関係の書類など、添付書類そのもの',
  '写真・図・画像（施工事例、ホームページの画面、予定地など）。載せたい資料は控えとして保存でき、Wordに手作業で貼り付けます',
  '売上・利益の状況の表（過去3年分）、事業スケジュールの○表。電子申請システムの表に直接入力します（文字での一覧は作成できます）',
  '加点を受けるための計画書や証明書類',
  '商工会・商工会議所が作成する事業支援計画書の発行（依頼先の記録のみ）',
  '電子申請の送信（GビズIDでのログイン・提出）。人が行います',
  '金額の算出・見積もり、採択の見込みの保証。AIは金額を作らず、ヒアリングにない数字は「【要確認】」と表示します',
]

const MAPPING: [string, string, string][] = [
  ['会社名・代表者・住所・設立日・資本金・URL', '基本情報', '住所は都道府県・市区町村・番地に分けて入ります。資本金は万円を円に直します'],
  ['連絡担当者、課税区分、インボイス特例、加点', '基本情報', '担当者名は姓と名に分けます'],
  ['過去3年の売上総利益・経常利益（直近期）', '基本情報', '直近売上と従業員数はヒアリングに入ります'],
  ['主力サービス上位3つ、顧客層', 'ヒアリング（1）', '顧客層は顧客ニーズの材料にもなります'],
  ['こだわり／課題／プラスの動向／マイナスの動向', 'ヒアリング（1）（2）', '順に、強み／弱み／機会／脅威として保存されます'],
  ['やりたいこと、売上の見込み、粗利率、増加率', 'ヒアリング（3）', '3年分の売上予想は自動で計算されます'],
  ['経費区分・内容・金額・個数・備考', '経費明細', '経費区分は、画面の表記（①機械装置等費など）に自動で合わせます'],
  ['補足情報（実施時期・業務効率化・受注状況・利益率・沿革・出典・実績・資料）', 'ヒアリング（4）〜（7）', 'AI下書きの材料になります'],
]

const SCREENS: [string, string, string][] = [
  ['案件一覧', '持続化パイロットを開く', '案件の作成・複製・削除、入力状況と補助額（見込み）の確認、検索・絞り込み'],
  ['基本情報', '案件を開く → 上のタブ', '会社情報の確認と修正、シートの反映、Wordダウンロード'],
  ['ヒアリング', '同上', '現状分析・今後の事業・補足情報の確認と入力、AI下書きの生成'],
  ['経費明細', '同上', '補助対象経費の確認、補助額の計算、資金調達'],
  ['レビュー', '同上', '下書きの確認、セクションごとの再生成、審査基準チェック'],
  ['エクスポート', '同上', '電子申請システム用のコピー、Wordダウンロード'],
]

const FAQ: [string, string][] = [
  ['2-1 市場の動向の出典はどう付く？', 'AI下書きの生成時に、政府機関のサイトだけを検索し、公表から2年以内の統計を集めます。各項目の直後に「（出典：機関名「統計名」公表年月 URL）」が付きます。検索で確認できなかった統計やURLは書かれず「【要確認：政府統計の出典】」になるので、その場合は担当者がURLを開いて確認し、本文に書き足してください。ヒアリングの「市場の動向の裏付けに使いたい統計・データ・出典」に書いた内容も参考にされます。'],
  ['下書きに別の会社の名前が出る', '下書きは、案件に登録された事業者名で作られます。シートを取り込むとき、事業者名が違えば更新するか聞かれるので「OK」にして、もう一度「保存してAI下書きを生成」を押してください。'],
  ['「【要確認】」が多い', 'ヒアリングで情報が足りないところです。ヒアリング画面の（4）補足情報などを埋めてから、もう一度生成してください。'],
  ['経費が二重になった', '同じシートを2回取り込むと、経費明細が追加されて重複します。経費明細の画面で、余分な行を削除してください。'],
  ['古いシート（v1・v2）で回答をもらった', 'そのまま取り込めます。補足情報の欄だけが空になるので、必要ならヒアリング画面で手入力してください。'],
  ['修正した内容が下書きに反映されない', '下書きは、生成した時点の入力で作られます。入力を直したら、もう一度「保存してAI下書きを生成」を押してください。今ある下書きは、新しいもので置き換わります。'],
  ['案件を削除してしまった', '削除は元に戻せません。ヒアリング・基本情報・経費・下書きもすべて消えます。迷うときは、削除ではなく複製を使ってください。'],
  ['AIの文章はそのまま出していい？', '下書きです。事実関係と数字は、必ずクライアントに確認してください。ヒアリングにない数字は、AIが作らないように指示してあり、代わりに「【要確認】」と出ます。'],
]

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            {head.map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-50 align-top last:border-0">
              {r.map((c, j) => <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'font-medium text-slate-800' : 'text-slate-600'}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Bullets({ items, mark, markCls }: { items: string[]; mark: string; markCls: string }) {
  return (
    <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate-700">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className={`mt-0.5 w-4 flex-shrink-0 text-center font-bold ${markCls}`}>{mark}</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

export default function JizokukaManualPage() {
  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6">
      <PageHeader
        title="持続化パイロット 操作マニュアル"
        description="ヒアリングシートの取込から、AI下書き、電子申請システムへのコピーまでの流れと手順です"
      >
        <Link href="/manual" className="btn-secondary">← マニュアル一覧</Link>
        <Link href="/jizokuka-pilot" className="btn-primary">持続化パイロットを開く</Link>
      </PageHeader>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="目次">
        {[['flow', '全体の流れ'], ['scope', '作成できる範囲'], ['steps', '操作手順'], ['mapping', 'シートの反映先'], ['screens', '画面の場所'], ['faq', '困ったとき']].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-brand-700 hover:border-brand-300">{label}</a>
        ))}
      </nav>

      <section id="flow" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="px-1 text-base font-bold text-slate-900">全体の流れ</h2>
        <div className="card overflow-x-auto p-3"><FlowDiagram /></div>
        <p className="px-1 text-xs text-slate-500">
          クライアントが動くのは③だけです。④〜⑦は、シートを取り込むボタン1回と「AI下書きを生成」ボタン1回で進みます。スマートフォンでは図を横にスクロールできます。
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-slate-500">
          {LANES.map(l => (
            <span key={l.key} className="flex items-center gap-1.5"><span className={`inline-block h-2.5 w-2.5 rounded-sm ${l.badge}`} />{l.label}{l.key === 'staff' ? '（人の操作）' : l.key === 'system' ? '（自動）' : ''}</span>
          ))}
        </div>
      </section>

      <section id="scope" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="px-1 text-base font-bold text-slate-900">このツールで作成できる資料の範囲</h2>
        <p className="px-1 text-sm text-slate-600">対象は、小規模事業者持続化補助金〈一般型〉の「様式2（経営計画書・補助事業計画書）」の文章と、その土台になる入力情報です。</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card flex flex-col gap-3 p-5">
            <h3 className="text-sm font-bold text-emerald-700">AIが下書きを作成する</h3>
            <Bullets items={SCOPE_OK_AI} mark="○" markCls="text-emerald-600" />
          </div>
          <div className="card flex flex-col gap-3 p-5">
            <h3 className="text-sm font-bold text-brand-700">入力した内容から整理・計算する</h3>
            <Bullets items={SCOPE_OK_INPUT} mark="○" markCls="text-brand-600" />
          </div>
        </div>
        <div className="card flex flex-col gap-3 p-5">
          <h3 className="text-sm font-bold text-red-600">作成できない（人が用意・入力する）もの</h3>
          <Bullets items={SCOPE_NG} mark="×" markCls="text-red-500" />
        </div>
      </section>

      <section id="steps" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="px-1 text-base font-bold text-slate-900">操作手順</h2>
        {STEPS.map(s => (
          <article key={s.n} className="card flex gap-4 p-5">
            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${laneOf(s.lane).badge}`}>{s.n}</div>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="text-xs text-slate-500">{s.who}</div>
              <h3 className="text-sm font-bold text-slate-900">{s.title}</h3>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-slate-700">
                {s.items.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
              {s.note && <div className="rounded-r-lg border-l-4 border-brand-500 bg-brand-50 px-3 py-2 text-sm text-slate-700">{s.note}</div>}
              {s.warn && <div className="rounded-r-lg border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-slate-700"><span className="font-bold text-red-600">提出前の確認：</span>{s.warn}</div>}
            </div>
          </article>
        ))}
      </section>

      <section id="mapping" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="px-1 text-base font-bold text-slate-900">シートの反映先</h2>
        <p className="px-1 text-sm text-slate-600">ヒアリングシートの各項目が、取り込んだあとどこに入るかの対応表です。</p>
        <Table head={['シートの項目', '入る場所', '補足']} rows={MAPPING} />
      </section>

      <section id="screens" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="px-1 text-base font-bold text-slate-900">画面の場所</h2>
        <Table head={['画面', '開き方', '主にすること']} rows={SCREENS} />
        <p className="px-1 text-xs text-slate-500">案件一覧の「入力状況」欄では、基本情報・ヒアリング・経費・下書きのうち、どこまで入っているかが色で分かります（緑＝入力済み、黄＝一部、灰＝未入力）。</p>
      </section>

      <section id="faq" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="px-1 text-base font-bold text-slate-900">困ったとき</h2>
        {FAQ.map(([q, a]) => (
          <div key={q} className="card p-4">
            <div className="text-sm font-bold text-slate-900">{q}</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{a}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
