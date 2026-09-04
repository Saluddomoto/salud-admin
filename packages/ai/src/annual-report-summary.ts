import Anthropic from '@anthropic-ai/sdk'
import type { MonthlyReportSummary } from './monthly-report-summary'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export interface AnnualReportPerson {
  fullName: string
  goal: string | null
  months: { period: string; sections: { label: string; value: string }[] }[]
}

// 年間分析は月次分析(MonthlyReportSummary)と同じ形（overview/highlights/risks/discussionAgenda/advice）を
// 年間視点で再利用する。highlights=年間の主な成果、risks=年間を通じて続く課題、
// discussionAgenda=来年に向けて議論すべきテーマ、advice=経営への提言、として扱う。
export type AnnualReportSummary = MonthlyReportSummary

const SYSTEM_PROMPT =
  'あなたは中小企業の経営会議に同席する経営アドバイザーです。' +
  '複数の役員が1年間、月ごとに書いてきた月報（今月の活動・営業・年間目標への進捗・課題・議論したいこと・来月の計画など）を' +
  'まとめて読み、年末や期首の振り返りで使える「年間の振り返り」を作成してください。' +
  '単月の出来事の羅列ではなく、月を追って見える傾向・積み上がった成果・繰り返し出てくる課題・年間目標への到達度に注目してください。' +
  '分析結果は必ず record_summary ツールを使って報告してください。'

const SUMMARY_TOOL: Anthropic.Tool = {
  name: 'record_summary',
  description: '年間の月報を横断分析した結果を構造化して報告する',
  input_schema: {
    type: 'object',
    properties: {
      overview: { type: 'string', description: '1年間の総括を4〜6文程度の日本語で' },
      highlights: {
        type: 'array',
        items: { type: 'string' },
        description: '1年間の主な成果・前進した点。簡潔な日本語の箇条書き3〜6件、該当が無ければ空配列',
      },
      risks: {
        type: 'array',
        items: { type: 'string' },
        description: '1年を通じて繰り返し出てきた・未解決のまま残っている課題。簡潔な日本語の箇条書き3〜6件、該当が無ければ空配列',
      },
      discussionAgenda: {
        type: 'array',
        items: { type: 'string' },
        description: '来年に向けて役員間で議論・意思決定すべきテーマ。簡潔な日本語の箇条書き3〜6件、該当が無ければ空配列',
      },
      advice: {
        type: 'array',
        items: { type: 'string' },
        description:
          '来年に向けた経営への具体的な提言。一般論・精神論は避け実行可能な内容にする。簡潔な日本語の箇条書き3〜6件、該当が無ければ空配列',
      },
    },
    required: ['overview', 'highlights', 'risks', 'discussionAgenda', 'advice'],
  },
}

/** 1年分（複数役員×複数月）の月報をまとめてClaudeに渡し、年間の振り返りを生成する */
export async function summarizeAnnualReports(
  year: number,
  people: AnnualReportPerson[],
): Promise<AnnualReportSummary> {
  const body = people
    .map(p => {
      const goalLine = p.goal ? `年間目標: ${p.goal}` : '年間目標: (未記入)'
      const monthLines = p.months
        .map(m => {
          const sectionLines = m.sections
            .filter(s => s.value.trim())
            .map(s => `  [${s.label}]\n  ${s.value.replace(/\n/g, '\n  ')}`)
            .join('\n\n')
          return `◆ ${m.period.slice(0, 7)}\n${sectionLines || '  (この月の記入なし)'}`
        })
        .join('\n\n')
      return `■ ${p.fullName}\n${goalLine}\n\n${monthLines || '(この年の記入なし)'}`
    })
    .join('\n\n---\n\n')

  const userContent = `対象年: ${year}年\n\n${body}`

  const response = await getClient().messages.create({
    model: 'claude-opus-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [SUMMARY_TOOL],
    tool_choice: { type: 'tool', name: SUMMARY_TOOL.name },
    messages: [{ role: 'user', content: userContent }],
  })

  if (response.stop_reason === 'max_tokens') {
    throw new Error('AIの応答が長すぎて途中で切れました。もう一度お試しください')
  }

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === SUMMARY_TOOL.name,
  )
  if (!toolBlock) {
    throw new Error('AI分析の結果を取得できませんでした')
  }

  const parsed = toolBlock.input as Partial<AnnualReportSummary>

  return {
    overview: parsed.overview ?? '',
    highlights: parsed.highlights ?? [],
    risks: parsed.risks ?? [],
    discussionAgenda: parsed.discussionAgenda ?? [],
    advice: parsed.advice ?? [],
  }
}
