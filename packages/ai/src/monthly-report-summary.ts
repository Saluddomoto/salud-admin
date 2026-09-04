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
  '分析結果は必ず record_summary ツールを使って報告してください。'

const SUMMARY_TOOL: Anthropic.Tool = {
  name: 'record_summary',
  description: '月報を横断分析した結果を構造化して報告する',
  input_schema: {
    type: 'object',
    properties: {
      overview: { type: 'string', description: '全体の状況を3〜5文程度の日本語で' },
      highlights: {
        type: 'array',
        items: { type: 'string' },
        description: '今月の好調な点・進捗。簡潔な日本語の箇条書き3〜6件、該当が無ければ空配列',
      },
      risks: {
        type: 'array',
        items: { type: 'string' },
        description: '複数人に共通する、または会社として見過ごせない課題。簡潔な日本語の箇条書き3〜6件、該当が無ければ空配列',
      },
      discussionAgenda: {
        type: 'array',
        items: { type: 'string' },
        description:
          '月末会議で扱うべき論点。各人の「議論したいこと」を踏まえて統合し重複は1つにまとめる。簡潔な日本語の箇条書き3〜6件、該当が無ければ空配列',
      },
      advice: {
        type: 'array',
        items: { type: 'string' },
        description:
          '経営として次に取るべき具体的な行動の提言。一般論・精神論は避け実行可能な内容にする。簡潔な日本語の箇条書き3〜6件、該当が無ければ空配列',
      },
    },
    required: ['overview', 'highlights', 'risks', 'discussionAgenda', 'advice'],
  },
}

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
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [SUMMARY_TOOL],
    tool_choice: { type: 'tool', name: SUMMARY_TOOL.name },
    messages: [{ role: 'user', content: userContent }],
  })

  // 万が一 max_tokens で途中切れした場合、ツール呼び出しが不完全なまま返るので
  // 原因が分かるようにしておく（response.stop_reason は 'max_tokens' | 'tool_use' 等）
  if (response.stop_reason === 'max_tokens') {
    throw new Error('AIの応答が長すぎて途中で切れました。もう一度お試しください')
  }

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === SUMMARY_TOOL.name,
  )
  if (!toolBlock) {
    throw new Error('AI分析の結果を取得できませんでした')
  }

  const parsed = toolBlock.input as Partial<MonthlyReportSummary>

  return {
    overview: parsed.overview ?? '',
    highlights: parsed.highlights ?? [],
    risks: parsed.risks ?? [],
    discussionAgenda: parsed.discussionAgenda ?? [],
    advice: parsed.advice ?? [],
  }
}
