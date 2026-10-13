import Anthropic from '@anthropic-ai/sdk'

/** コラムを書く対象の補助金（根拠テキスト付き） */
export type ColumnSubsidy = {
  key: string
  name: string
  facts: string
  sourceLabel: string
  sourceUrl: string
  checkedAt: string
  relatedPath: string
}

// コラム1本分をAIに書かせ、salud-web.jp の既存コラムと同じ体裁のHTMLに組み立てる。
// 事実は「公募要領の本文(subsidy.facts)」だけを根拠にし、書けない点は unsure に出させる。

const MODEL = 'claude-sonnet-5-5'

export type ColumnArticle = {
  title: string
  slug: string
  metaDescription: string
  html: string
  unsure: string[]
}

type Block =
  | { type: 'h2' | 'h3' | 'p'; text: string }
  | { type: 'ul'; items: string[] }

type ArticleDraft = {
  title: string
  slug: string
  meta_description: string
  lead: string
  key_points: string[]
  blocks: Block[]
  faq: { q: string; a: string }[]
  summary_points: string[]
  unsure: string[]
}

const ARTICLE_TOOL: Anthropic.Tool = {
  name: 'submit_article',
  description: 'コラム記事1本分を提出する',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '記事タイトル（40字前後。検索されやすい言葉を含める）' },
      slug: { type: 'string', description: 'URLの末尾。半角英小文字とハイフンのみ、3〜6語' },
      meta_description: { type: 'string', description: '検索結果に出る説明文（90〜120字）' },
      lead: { type: 'string', description: '導入段落（2〜3文）。この記事で何が分かるかを書く' },
      key_points: { type: 'array', items: { type: 'string' }, description: '「この記事の結論」の箇条書き（3〜5個）' },
      blocks: {
        type: 'array',
        description: '本文。h2/h3 の見出し、p の段落、ul の箇条書きを順に並べる。h2 は3〜5個。',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['h2', 'h3', 'p', 'ul'] },
            text: { type: 'string', description: 'h2/h3/p のとき' },
            items: { type: 'array', items: { type: 'string' }, description: 'ul のとき' },
          },
          required: ['type'],
        },
      },
      faq: {
        type: 'array',
        description: 'よくある質問と回答（4〜5個）',
        items: {
          type: 'object',
          properties: { q: { type: 'string' }, a: { type: 'string' } },
          required: ['q', 'a'],
        },
      },
      summary_points: { type: 'array', items: { type: 'string' }, description: 'まとめの箇条書き（3〜4個）' },
      unsure: {
        type: 'array',
        items: { type: 'string' },
        description: '根拠テキストだけでは断定できず、人の確認が必要な点（なければ空配列）',
      },
    },
    required: ['title', 'slug', 'meta_description', 'lead', 'key_points', 'blocks', 'faq', 'summary_points', 'unsure'],
  },
}

const SYSTEM_PROMPT = [
  'あなたは、中小企業向けに補助金を解説する「株式会社Salud」のコラム執筆者です。',
  '読者は、補助金を検討している中小企業・小規模事業者の経営者です。',
  '',
  '【絶対に守ること】',
  '1. 事実（金額・補助率・日付・要件・対象経費・提出書類・用語の定義）は、渡された「根拠テキスト」に書かれていることだけを使う。根拠テキストにないことは、書かない。',
  '2. 根拠テキストから断定できない点、解釈が分かれる点は、本文では断定せず「公募要領や事務局への確認が必要」と書き、unsure にも1行で列挙する。',
  '3. 「必ず採択される」「絶対」「100%」など、結果を保証する表現は使わない。',
  '4. 事業計画書は申請者ご自身で作成するものとし、Saludが代わりに作成する・採択を請け負う、とは書かない。Saludは「要件の確認や整理のお手伝い」をする立場。',
  '5. 数字は根拠テキストの表記どおりに書き写す。計算や推測で新しい数字を作らない。',
  '',
  '【書き方】',
  '・です・ます調。1文は短く。専門用語は、初出で短く言い換える。',
  '・重要な語句は **太字**、特に重要な箇所（金額・締切・必須要件など）は ==マーカー== で囲む。HTMLタグは書かない。',
  '・本文はh2を3〜5個。具体例や「やってはいけない例」を入れて、読者が自社に当てはめられるようにする。',
  '・「既存の記事」と同じ切り口・同じタイトルは避け、読者の疑問に1つだけ深く答える記事にする。',
].join('\n')

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const MARK_STYLE = 'background:linear-gradient(transparent 55%,#fff176 55%);color:inherit;padding:0 2px;'

// **太字** と ==マーカー== だけをHTMLに変換する（それ以外のタグは出さない）
function inline(text: string): string {
  return esc(String(text ?? ''))
    .replace(/==(.+?)==/g, `<strong><mark style="${MARK_STYLE}">$1</mark></strong>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function plain(text: string): string {
  return String(text ?? '').replace(/==|\*\*/g, '')
}

function ctaBar(label: string): string {
  return (
    `<p style="background:#fffbe0;border:1px solid #f0d860;border-radius:10px;padding:12px 16px;margin:18px 0;font-size:15px;">✔ <strong>迷ったら、先に相談を。</strong>` +
    `要件や経費の確認は、<a href="https://salud-web.jp/contact/" onclick="if(window.gtag){gtag('event','cta_contact_click',{event_category:'cta',event_label:'${label}'});}"><strong>無料相談フォーム</strong></a>` +
    `または<a href="https://line.me/R/ti/p/@388rsdlz"><strong>LINE</strong></a>から受け付けています。</p>`
  )
}

function ctaEnd(label: string, headline: string): string {
  return (
    `<div style="background:linear-gradient(135deg,#183e5c,#1f6a96);color:#fff;border-radius:16px;padding:26px 22px;margin:32px 0;text-align:center;">` +
    `<p style="margin:0 0 6px;font-size:13px;letter-spacing:.1em;color:#fff176;font-weight:700;">無料相談 受付中</p>` +
    `<p style="margin:0 0 10px;font-size:21px;font-weight:700;line-height:1.5;color:#fff;">${esc(headline)}</p>` +
    `<p style="margin:0 0 18px;font-size:14px;line-height:1.8;color:#e8f1f7;">要件や経費の確認を、無料でご相談ください。<br />事業計画は申請者ご自身で作成いただきますが、要件の確認や整理のお手伝いをしています。</p>` +
    `<p><a href="https://salud-web.jp/contact/" onclick="if(window.gtag){gtag('event','cta_contact_click',{event_category:'cta',event_label:'${label}_contact'});}" style="display:inline-block;background:#fff176;color:#1c2733;font-weight:700;font-size:16px;padding:14px 30px;border-radius:999px;text-decoration:none;margin:5px;">無料で相談する →</a>` +
    `<a href="https://line.me/R/ti/p/@388rsdlz" onclick="if(window.gtag){gtag('event','cta_contact_click',{event_category:'cta',event_label:'${label}_line'});}" style="display:inline-block;background:#06c755;color:#fff;font-weight:700;font-size:16px;padding:14px 30px;border-radius:999px;text-decoration:none;margin:5px;">LINEで相談する</a></p></div>`
  )
}

function buildHtml(a: ArticleDraft, subsidy: ColumnSubsidy): string {
  const slugKey = String(a.slug ?? '').replace(/[^a-z0-9-]/g, '').slice(0, 24)
  const parts: string[] = []

  if (a.unsure.length > 0) {
    // 公開しても表示されないコメント。編集画面のコードエディタで確認できる
    parts.push(`<!-- 要確認（自動生成）:\n${a.unsure.map(u => `- ${String(u).replace(/--/g, '－')}`).join('\n')}\n-->`)
  }

  parts.push(`<p>${inline(a.lead)}</p>`)
  parts.push(
    `<div style="background:#f4f8fb;border:2px solid #1f6a96;border-radius:12px;padding:18px 20px;margin:20px 0;">` +
    `<p style="margin:0 0 8px;font-weight:700;color:#183e5c;font-size:17px;">この記事の結論（要点）</p>` +
    `<ul style="margin:0;padding-left:20px;line-height:1.9;">${a.key_points.map(p => `<li>${inline(p)}</li>`).join('')}</ul></div>`,
  )
  parts.push(
    `<p><strong>ご注意：</strong>この記事は、${esc(subsidy.sourceLabel)}をもとにした概要です。公募要領は改訂されることがあります。申請の前に、必ず最新の公募要領でご確認ください。</p>`,
  )
  parts.push(ctaBar(`p_${slugKey}_top`))

  let h2Count = 0
  for (const b of a.blocks) {
    if (b.type !== 'ul' && !(b as { text?: string }).text) continue
    if (b.type === 'h2') {
      h2Count += 1
      // 2つ目の見出しの手前に中ほどのCTAを入れる
      if (h2Count === 3) parts.push(ctaBar(`p_${slugKey}_mid`))
      parts.push(`<h2>${esc(plain(b.text))}</h2>`)
    } else if (b.type === 'h3') {
      parts.push(`<h3>${esc(plain(b.text))}</h3>`)
    } else if (b.type === 'p') {
      parts.push(`<p>${inline(b.text)}</p>`)
    } else if (b.type === 'ul') {
      parts.push(`<ul>${(b.items ?? []).map(i => `<li>${inline(i)}</li>`).join('')}</ul>`)
    }
  }

  parts.push('<h2>よくある質問（Q&amp;A）</h2>')
  a.faq = a.faq.filter(f => f && f.q && f.a)
  for (const f of a.faq) {
    parts.push(`<h3>Q. ${esc(plain(f.q))}</h3>`, `<p>A. ${inline(f.a)}</p>`)
  }
  const faqJson = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: a.faq.map(f => ({
      '@type': 'Question',
      name: plain(f.q),
      acceptedAnswer: { '@type': 'Answer', text: plain(f.a) },
    })),
  }
  // </ を含む文字列で script が途切れないようにする
  parts.push(`<p><script type="application/ld+json">${JSON.stringify(faqJson).replace(/</g, '\\u003c')}</script></p>`)

  parts.push('<h2>まとめ</h2>', `<ul>${a.summary_points.map(p => `<li>${inline(p)}</li>`).join('')}</ul>`)
  parts.push(ctaEnd(`p_${slugKey}_end`, '自社の場合はどうなる？まずは無料でご相談ください'))

  parts.push(
    '<h2>出典と最終確認日</h2>',
    `<ul><li>出典：${esc(subsidy.sourceLabel)}（<a href="${esc(subsidy.sourceUrl)}">公式情報</a>）</li>` +
    `<li>最終確認日：${esc(subsidy.checkedAt.replace(/^(\d+)-(\d+)-(\d+)$/, (_, y, m, d) => `${y}年${Number(m)}月${Number(d)}日`))}</li>` +
    `<li>執筆：株式会社Salud（補助金の申請支援・Web制作）</li></ul>`,
  )
  parts.push(
    '<h2>関連記事</h2>',
    `<ul><li><a href="https://salud-web.jp${esc(subsidy.relatedPath)}">${esc(subsidy.name)}のご案内</a></li></ul>`,
  )

  return parts.join('\n')
}

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export async function generateColumn(params: {
  subsidy: ColumnSubsidy
  existingTitles: string[]
  today: string
}): Promise<ColumnArticle> {
  const { subsidy, existingTitles, today } = params

  const userText = [
    `今日の日付: ${today}`,
    `今回の補助金: ${subsidy.name}`,
    '',
    '【既存の記事（同じ切り口は避ける）】',
    existingTitles.length ? existingTitles.map(t => `・${t}`).join('\n') : '（まだありません）',
    '',
    '上のリストにない切り口で、読者が検索しそうな疑問を1つ選び、コラム1本を書いて、必ず submit_article ツールを呼んで提出してください（文章での返答はしない）。',
    '',
    '【根拠テキスト（これ以外の事実は書かない）】',
    subsidy.facts,
  ].join('\n')

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 12000,
    system: SYSTEM_PROMPT,
    tools: [ARTICLE_TOOL],
    // このモデルは tool_choice の強制指定('tool'/'any')に非対応。ツールは1つだけなので auto で呼ばせる
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: userText }],
  })

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === ARTICLE_TOOL.name,
  )
  if (!toolUse) throw new Error('column: AIの出力が取得できませんでした')
  const draft = toolUse.input as ArticleDraft
  // モデルが配列項目を文字列で返すことがあるため、配列に正規化する
  const toArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String)
    : typeof v === 'string' ? v.split(/\n+/).map(s => s.replace(/^\s*[-・•*]\s*/, '').trim()).filter(Boolean)
    : []
  draft.unsure = toArr(draft.unsure)
  draft.key_points = toArr(draft.key_points)
  draft.summary_points = toArr(draft.summary_points)
  for (const b of (draft.blocks ?? []) as { items?: unknown }[]) if (b.items !== undefined) b.items = toArr(b.items)
  if (!draft.title || !draft.blocks?.length || !draft.faq?.length) {
    throw new Error('column: AIの出力が不完全です')
  }

  const slug = (draft.slug || 'column').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return {
    title: plain(draft.title).trim(),
    slug: `${subsidy.key}-${slug}`.slice(0, 80),
    metaDescription: plain(draft.meta_description ?? '').trim(),
    html: buildHtml({ ...draft, slug }, subsidy),
    unsure: (draft.unsure ?? []).map(plain),
  }
}
