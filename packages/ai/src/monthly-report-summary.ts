import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export interface MonthlyReportPerson {
  fullName: string
  goal: string | null
  sections: { label: string; value: string }[]
}

export interface MonthlyReportSummary {
  overview: string
  highlights: string[]
  risks: string[]
  discussionAgenda: string[]
  advice: string[]
}

const SYSTEM_PROMPT =
  'あなたは中小企業の経営会議に同席する経営アドバイザーです。' +
  '複数の役員が書いた月次の月報（今月の活動・営業・年間目標への進捗・課題・議論したいこと・来月の計画など）を' +
  'まとめて読み、月末の役員会議で使える形に整理してください。' +
  '個々人の内容を単に要約するのではなく、複数人の内容を横断して見える共通点・矛盾・連携すべき点に注目してください。' +
  '出力は次のJSON形式のみとし、前後に説明文やマークダウンのコードブロック記法を付けないこと: ' +
  '{"overview": string, "highlights": string[], "risks": string[], "discussionAgenda": string[], "advice": string[]}。' +
  'overview は全体の状況を3〜5文程度の日本語で。' +
  'highlights（今月の好調な点・進捗）/ risks（複数人に共通する、または会社として見過ごせない課題）/ ' +
  'discussionAgenda（月末会議で扱うべき論点。各人の「議論したいこと」を踏まえて統合し、重複は1つにまとめる）/ ' +
  'advice（経営として次に取るべき具体的な行動の提言。一般論・精神論は避け、実行可能な内容にする）は、' +
  'それぞれ簡潔な日本語の箇条書き（3〜6件程度）とし、該当する内容が無ければ空配列にすること。'

/** 複数役員分の月報をまとめてClaudeに渡し、月末会議向けの要約・アドバイスを生成する */
export async function summarizeMonthlyReports(
  period: string,
  people: MonthlyReportPerson[],
): Promise<MonthlyReportSummary> {
  const body = people
    .map(p => {
      const goalLine = p.goal ? `年間目標: ${p.goal}` : '年間目標: (未記入)'
      const sectionLines = p.sections
        .filter(s => s.value.trim())
        .map(s => `[${s.label}]\n${s.value}`)
        .join('\n\n')
      return `■ ${p.fullName}\n${goalLine}\n\n${sectionLines || '(この月の記入なし)'}`
    })
    .join('\n\n---\n\n')

  const userContent = `対象月: ${period}\n\n${body}`

  const response = await getClient().messages.create({
    model: 'claude-opus-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('AI分析の結果を取得できませんでした')
  }

  const jsonText = textBlock.text
    .trim()
    .replace(/^```(json)?/, '')
    .replace(/```$/, '')
    .trim()

  const parsed = JSON.parse(jsonText) as Partial<MonthlyReportSummary>
  return {
    overview: parsed.overview ?? '',
    highlights: parsed.highlights ?? [],
    risks: parsed.risks ?? [],
    discussionAgenda: parsed.discussionAgenda ?? [],
    advice: parsed.advice ?? [],
  }
}
