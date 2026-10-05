import Anthropic from '@anthropic-ai/sdk'

// 持続化パイロット: 「2-1 市場の動向」の根拠にする政府統計を、政府サイトに限定したWeb検索で集める。
// AIの記憶だけで統計名・数値・URLを書かせると誤りが混ざるため、
//   1) 検索対象を政府機関のドメインに限定し
//   2) 検索結果に実際に現れたURLだけを採用し
//   3) 公表から2年以内のものだけを残す
// という検証をコード側で行う。

export interface MarketSource {
  organization: string
  statName: string
  /** 公表年月（YYYY-MM） */
  published: string
  /** 統計から読み取れる要点（数値を含む） */
  figure: string
  url: string
}

const GOV_DOMAINS = [
  'e-stat.go.jp', 'stat.go.jp', 'soumu.go.jp', 'meti.go.jp', 'chusho.meti.go.jp', 'mlit.go.jp',
  'mhlw.go.jp', 'maff.go.jp', 'cao.go.jp', 'mof.go.jp', 'env.go.jp', 'jftc.go.jp', 'caa.go.jp',
  'digital.go.jp', 'kantei.go.jp', 'npa.go.jp', 'mext.go.jp',
]

const MAX_YEARS = 2

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

/** 公表年月がこの月以降（今日から2年以内）であること */
export function oldestAllowedMonth(today: Date = new Date()): string {
  const total = today.getFullYear() * 12 + today.getMonth() - MAX_YEARS * 12
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

const isGovUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname
    return host === 'go.jp' || host.endsWith('.go.jp')
  } catch {
    return false
  }
}

const RECORD_TOOL: Anthropic.Tool = {
  name: 'record_sources',
  description: '検索で実際に確認できた政府統計だけを報告する。確認できなければ空の配列を返す',
  input_schema: {
    type: 'object',
    properties: {
      sources: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            organization: { type: 'string', description: '公表した府省庁・機関名（例：総務省統計局）' },
            statName: { type: 'string', description: '統計・調査・白書の正式名称' },
            published: { type: 'string', description: '公表年月。YYYY-MM形式（例：2025-09）。ページで確認できない場合は含めない' },
            figure: { type: 'string', description: 'そのページに書かれている、事業の市場動向に関係する要点（数値は原文のとおり）' },
            url: { type: 'string', description: '検索結果に現れたURLそのもの' },
          },
          required: ['organization', 'statName', 'published', 'figure', 'url'],
        },
      },
    },
    required: ['sources'],
  },
}

export interface MarketResearchInput {
  businessName: string
  industry: string
  topServices?: string
  customerSegments?: string
  marketTrends?: string
}

/** 政府統計（公表から2年以内）を検索し、検証済みのものだけを返す。失敗時は空配列 */
export async function researchMarketSources(input: MarketResearchInput, today: Date = new Date()): Promise<MarketSource[]> {
  const oldest = oldestAllowedMonth(today)
  const todayStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`

  const system =
    'あなたは小規模事業者持続化補助金の申請書に載せる「市場の動向」の根拠を調べる調査担当です。' +
    '政府機関のサイトだけを検索し、事業者の業種・主力サービスの市場動向（需要の増減、業界の課題、顧客の動向、' +
    '資材・人件費の動向など）に関係する統計・調査・白書を2〜4件見つけてください。' +
    `今日は${todayStr}です。公表年月が${oldest}以降（今日から2年以内）のものだけを採用し、` +
    '公表年月がページで確認できないものは採用しないでください。' +
    '記憶だけで統計名・数値・URLを書かないこと。検索結果のページに書かれている内容だけを要点にすること。' +
    '調べ終えたら必ず record_sources を呼び、確認できたものがなければ空の配列を報告してください。'

  const user =
    `事業者: ${input.businessName}\n業種: ${input.industry}\n` +
    (input.topServices ? `主力サービス: ${input.topServices}\n` : '') +
    (input.customerSegments ? `顧客層: ${input.customerSegments}\n` : '') +
    (input.marketTrends ? `ヒアリングで聞いた市場の動向: ${input.marketTrends}\n` : '')

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: user }]
  const seenUrls = new Set<string>()
  let recorded: unknown[] | null = null

  for (let turn = 0; turn < 4; turn++) {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      system,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 5, allowed_domains: GOV_DOMAINS },
        RECORD_TOOL,
      ],
      messages,
    })

    for (const block of response.content) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === 'web_search_result') seenUrls.add(r.url)
      }
      if (block.type === 'tool_use' && block.name === RECORD_TOOL.name) {
        recorded = ((block.input as { sources?: unknown[] }).sources ?? [])
      }
    }
    if (recorded) break
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content })
      continue
    }
    break
  }

  const verified: MarketSource[] = []
  for (const raw of recorded ?? []) {
    const s = raw as Partial<MarketSource>
    if (!s.url || !s.published || !s.statName || !s.organization || !s.figure) continue
    if (!isGovUrl(s.url)) continue
    if (!seenUrls.has(s.url)) continue // 検索結果に実在したURLのみ
    if (!/^\d{4}-\d{2}$/.test(s.published) || s.published < oldest) continue
    verified.push({ organization: s.organization, statName: s.statName, published: s.published, figure: s.figure, url: s.url })
  }
  return verified
}

const ymLabel = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`

/** AIへ渡す「調査済みの政府統計」テキスト */
export function formatMarketSources(sources: MarketSource[]): string {
  return sources
    .map((s, i) => `[${i + 1}] ${s.organization}「${s.statName}」（${ymLabel(s.published)}公表）要点: ${s.figure} URL: ${s.url}`)
    .join('\n')
}

const URL_PATTERN = /https?:\/\/[^\s）)」】、。]+/g

/** 本文中のURLのうち、許可されたもの以外を「【要確認：出典】」に置き換える（創作された出典の混入を防ぐ） */
export function sanitizeCitations(body: string, allowedUrls: Iterable<string>): string {
  const allowed = new Set(allowedUrls)
  return body.replace(URL_PATTERN, url => (allowed.has(url) ? url : '【要確認：出典】'))
}

export function extractUrls(text: string): string[] {
  return text.match(URL_PATTERN) ?? []
}
