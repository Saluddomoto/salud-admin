import Anthropic from '@anthropic-ai/sdk'

/** コラムを書く対象の補助金（根拠テキスト付き） */
export type ColumnSubsidy = {
  key: string
  name: string
  facts: string
  /** 公募要領に書かれていない、弊社の実務上の知見（任意）。事実とは区別して使わせる */
  practicalNotes?: string
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
  /** アイキャッチ画像に入れる文言 */
  thumb: { lines: string[]; sub: string }
  /** 狙うキーワードと、SEO/AIOの効果予測（担当者向け。記事には載せない） */
  insight: { keywords: string[]; seo: string; aio: string }
}

type Block =
  | { type: 'h2' | 'h3' | 'p'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'chat'; lines: { who: '経営者' | '担当者'; text: string }[] }

type BuiltArticle = {
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

type ArticleDraft = {
  title: string
  slug: string
  meta_description: string
  lead: string
  key_points: string[]
  body: string
  faq_text: string
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
      target_keywords: { type: 'array', items: { type: 'string' }, description: '狙う検索キーワード（主キーワード1つ＋関連2〜4つ。実際に検索されそうな言い方）' },
      seo_forecast: { type: 'string', description: 'SEOの効果予測（担当者向け・200字以内）。検索意図、競合の強さの見立て、狙える順位帯と時期の目安を、「高/中/低」の評価と理由で。数値の断定はしない。' },
      aio_forecast: { type: 'string', description: 'AIO（AI検索・生成AIでの引用）の効果予測（担当者向け・200字以内）。引用されやすい箇所（結論文・表・手順・Q&A）と、弱い点を、「高/中/低」の評価と理由で。数値の断定はしない。' },
      thumb_line1: { type: 'string', description: 'サムネイル画像の1行目（全角14字以内。タイトルの要点。途中で不自然に切らない）' },
      thumb_line2: { type: 'string', description: 'サムネイル画像の2行目（全角14字以内。疑問形で終えてもよい）' },
      thumb_sub: { type: 'string', description: 'サムネイル画像の補足（全角28字以内。補助金名や期限など）' },
      lead: { type: 'string', description: '導入段落（2〜3文）。この記事で何が分かるかを書く' },
      key_points: { type: 'array', items: { type: 'string' }, description: '「この記事の結論」の箇条書き（3〜5個）' },
      body: {
        type: 'string',
        description:
          '本文。行頭の「## 」=h2（3〜5個・疑問形）、「### 」=h3、段落は空行で区切る、「- 」=箇条書き、「1. 」=手順、「| 項目 | … |」=表（2行目に|---|---|）、「経営者：」「担当者：」=会話。表を最低1つ、手順を最低1つ、会話を1か所入れる。',
      },
      faq_text: {
        type: 'string',
        description: 'よくある質問と回答（4〜5個）。1問につき「Q: 質問」の行と「A: 回答」の行を書き、問と問の間は空行にする。',
      },
      summary_points: { type: 'array', items: { type: 'string' }, description: 'まとめの箇条書き（3〜4個）' },
      unsure: {
        type: 'array',
        items: { type: 'string' },
        description: '根拠テキストだけでは断定できず、人の確認が必要な点（なければ空配列）',
      },
    },
    required: ['title', 'slug', 'meta_description', 'target_keywords', 'seo_forecast', 'aio_forecast', 'thumb_line1', 'thumb_line2', 'thumb_sub', 'lead', 'key_points', 'body', 'faq_text', 'summary_points', 'unsure'],
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
  '',
  '【AIO対策（AI検索・生成AIに引用されやすくする。全記事で必須）】',
  '・lead（導入）は、記事の問いへの答えを最初の1〜2文で言い切る。その文だけ読んでも意味が通るようにし、「これ」「それ」など指示語で始めない。',
  '・h2の見出しは、読者が検索しそうな「疑問の形」にする（例：「事業支援計画書（様式4）とは何ですか？」「いつまでに発行を依頼すればよいですか？」）。',
  '・各h2の直後の最初の段落は、見出しの問いに対する結論を1文（60字前後）で言い切る。そのあとに理由・条件・例外を書く。',
  '・用語を初めて出すときは「〇〇とは、△△のことです。」の形で定義する。',
  '・主語や固有名詞（補助金名・書類名・「第20回」など）を省略せず、段落だけ抜き出されても意味が通るように書く。',
  '・比較や条件の整理には、必ず表を使う。記事全体で表を最低1つ入れる。',
  '・手順や流れには、必ず番号付きの手順（1. 2. 3.）を使う。記事全体で最低1つ入れる。',
  '・読者がつまずきやすい疑問を、経営者と担当者の短い会話（4〜6行）で1か所入れる。会話の中身も、根拠テキストの事実だけで作る。',
  '・日付・金額・件数など、根拠テキストにある具体的な数字は、はっきり書く（書き写す。作らない）。',
  '',
  '【担当者向けの分析（記事には載せない）】',
  '・target_keywords は、実際の検索で使われそうな言葉にする。seo_forecast と aio_forecast は、検索ボリュームや順位を数字で断定せず、根拠のある見立て（高/中/低と理由）として書く。「必ず上位表示される」とは書かない。',
  '',
  '【本文(body)の記法】',
  '・見出しは行頭の「## 」(h2)・「### 」(h3)。段落は空行で区切る。',
  '・箇条書きは行頭の「- 」。番号付きの手順は行頭の「1. 」「2. 」…。',
  '・表は、行を「| 項目 | 内容A | 内容B |」の形で書き、2行目に「|---|---|---|」を置く。セルの中では改行しない。',
  '・会話は、行頭を「経営者：」または「担当者：」で始める（1行に1発言）。',
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

function buildHtml(a: BuiltArticle, subsidy: ColumnSubsidy, today: string): string {
  const slugKey = String(a.slug ?? '').replace(/[^a-z0-9-]/g, '').slice(0, 24)
  const parts: string[] = []

  // 「要確認」は記事に埋め込まない（HTMLソースに残り、公開後に誰でも読めてしまうため）。
  // 呼び出し側でLINE通知と column_drafts に残す。

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
    if (b.type === 'table') {
      const [head, ...body] = b.rows
      if (!head?.length) continue
      const cell = 'border:1px solid #c9d6e0;padding:8px 10px;vertical-align:top;'
      parts.push(
        `<div style="overflow-x:auto;margin:16px 0;"><table style="border-collapse:collapse;width:100%;min-width:480px;font-size:15px;line-height:1.7;">` +
        `<thead><tr>${head.map(c => `<th style="${cell}background:#eaf2f8;text-align:left;">${inline(c)}</th>`).join('')}</tr></thead>` +
        `<tbody>${body.map(r => `<tr>${r.map(c => `<td style="${cell}">${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
      )
      continue
    }
    if (b.type === 'chat') {
      if (!b.lines.length) continue
      parts.push(
        `<div style="background:#f7f9fb;border:1px solid #dde6ee;border-radius:12px;padding:12px 14px;margin:16px 0;">` +
        b.lines.map(l => {
          const owner = l.who === '経営者'
          return `<p style="margin:8px 0;display:flex;gap:8px;align-items:flex-start;${owner ? '' : 'flex-direction:row-reverse;'}">` +
            `<span style="flex:none;font-size:12px;font-weight:700;color:#fff;background:${owner ? '#6b7c8c' : '#1f6a96'};border-radius:999px;padding:3px 9px;">${l.who}</span>` +
            `<span style="background:${owner ? '#fff' : '#e3f1fa'};border:1px solid #dde6ee;border-radius:10px;padding:8px 12px;line-height:1.7;">${inline(l.text)}</span></p>`
        }).join('') + `</div>`,
      )
      continue
    }
    if (b.type === 'ol') {
      parts.push(`<ol>${(b.items ?? []).map(i => `<li>${inline(i)}</li>`).join('')}</ol>`)
      continue
    }
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
  // 記事そのものの構造化データ（AI検索・検索エンジンが、誰がいつ書いた記事かを読み取れるようにする）
  const articleJson = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: plain(a.title),
    description: plain(a.meta_description),
    inLanguage: 'ja',
    datePublished: today,
    dateModified: today,
    author: { '@type': 'Organization', name: '株式会社Salud', url: 'https://salud-web.jp/' },
    publisher: { '@type': 'Organization', name: '株式会社Salud', url: 'https://salud-web.jp/' },
    about: subsidy.name,
  }
  parts.push(`<p><script type="application/ld+json">${JSON.stringify(articleJson).replace(/</g, '\\u003c')}</script></p>`)

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
    ...(subsidy.practicalNotes
      ? ['', '【弊社の実務上の知見（公募要領の事実ではない。使う場合は必ず「公募要領には記載がありませんが、実務では」「弊社の経験では」のように区別して書く。断定しない）】', subsidy.practicalNotes]
      : []),
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
  const raw = toolUse.input as Record<string, unknown>
  const rawInfo = `keys=${Object.keys(raw).join(',')} body=${typeof raw.body}:${String(raw.body ?? '').slice(0, 120)} faq_text=${typeof raw.faq_text}:${String(raw.faq_text ?? '').slice(0, 80)} stop=${response.stop_reason}`
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  // 箇条書き項目は、配列でも改行区切りの文字列でも受ける
  const toArr = (v: unknown): string[] => {
    if (typeof v === 'string') {
      try { const j = JSON.parse(v); if (Array.isArray(j)) return j.map(String) } catch { /* 文字列として扱う */ }
      return v.split(/\n+/).map(s => s.replace(/^\s*[-・•*]\s*/, '').trim()).filter(Boolean)
    }
    return Array.isArray(v) ? v.map(String) : []
  }
  // 本文: 「## 」h2、「### 」h3、「- 」箇条書き、「1. 」手順、「| 」表、「経営者：/担当者：」会話、空行区切りの段落
  const blocks: Block[] = []
  let para: string[] = []
  let items: string[] = []
  let steps: string[] = []
  let tableRows: string[][] = []
  let chat: { who: '経営者' | '担当者'; text: string }[] = []
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join('') })
    if (items.length) blocks.push({ type: 'ul', items })
    if (steps.length) blocks.push({ type: 'ol', items: steps })
    if (tableRows.length) blocks.push({ type: 'table', rows: tableRows })
    if (chat.length) blocks.push({ type: 'chat', lines: chat })
    para = []; items = []; steps = []; tableRows = []; chat = []
  }
  for (const line of str(raw.body).split('\n')) {
    const t = line.trim()
    if (!t) { flush(); continue }
    if (t.startsWith('### ')) { flush(); blocks.push({ type: 'h3', text: t.slice(4) }) }
    else if (t.startsWith('## ')) { flush(); blocks.push({ type: 'h2', text: t.slice(3) }) }
    else if (t.startsWith('|')) {
      if (!tableRows.length) flush()
      const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue // 区切り行
      tableRows.push(cells)
    }
    else if (/^(経営者|担当者)[:：]/.test(t)) {
      if (!chat.length) flush()
      const m = t.match(/^(経営者|担当者)[:：]\s*(.*)$/)!
      chat.push({ who: m[1] as '経営者' | '担当者', text: m[2]! })
    }
    else if (/^\d+[.．)）]\s*/.test(t)) { if (!steps.length) flush(); steps.push(t.replace(/^\d+[.．)）]\s*/, '')) }
    else if (/^[-・•*]\s+/.test(t)) { if (!items.length) flush(); items.push(t.replace(/^[-・•*]\s+/, '')) }
    else { if (!para.length) flush(); para.push(t) }
  }
  flush()
  // よくある質問: 「Q: 」「A: 」の行
  const faq: { q: string; a: string }[] = []
  for (const line of str(raw.faq_text).split('\n')) {
    const t = line.trim()
    const mq = t.match(/^Q[:：.]\s*(.+)$/i)
    const ma = t.match(/^A[:：.]\s*(.+)$/i)
    if (mq) faq.push({ q: mq[1]!, a: '' })
    else if (ma && faq.length) faq[faq.length - 1]!.a += ma[1]
    else if (t && faq.length && faq[faq.length - 1]!.a) faq[faq.length - 1]!.a += t
  }
  const draft = {
    title: str(raw.title),
    slug: str(raw.slug),
    meta_description: str(raw.meta_description),
    lead: str(raw.lead),
    key_points: toArr(raw.key_points),
    blocks,
    faq: faq.filter(f => f.q && f.a),
    summary_points: toArr(raw.summary_points),
    unsure: toArr(raw.unsure),
  }
  if (!draft.title || !draft.blocks.length || !draft.faq.length) {
    throw new Error(`column: AIの出力が不完全です ${rawInfo}`)
  }

  // サムネイルの文言。AIが返さなかったときは、タイトルを2行に分けて代用する
  let thumbLines = [str(raw.thumb_line1), str(raw.thumb_line2)].map(plain).map(x => x.trim()).filter(Boolean)
  if (!thumbLines.length) {
    const t = plain(draft.title)
    const cut = Math.ceil(t.length / 2)
    thumbLines = t.length > 14 ? [t.slice(0, cut), t.slice(cut)] : [t]
  }
  const thumb = { lines: thumbLines, sub: plain(str(raw.thumb_sub)).trim() }

  const slug = (draft.slug || 'column').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return {
    title: plain(draft.title).trim(),
    slug: `${subsidy.key}-${slug}`.slice(0, 80),
    metaDescription: plain(draft.meta_description ?? '').trim(),
    html: buildHtml({ ...draft, slug }, subsidy, today),
    unsure: (draft.unsure ?? []).map(plain),
    thumb: thumb,
    insight: {
      keywords: toArr(raw.target_keywords).map(plain).slice(0, 6),
      seo: plain(str(raw.seo_forecast)).trim(),
      aio: plain(str(raw.aio_forecast)).trim(),
    },
  }
}
