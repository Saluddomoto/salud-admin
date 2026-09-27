import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export interface EvaluationCriterionResult {
  label: string
  verdict: '十分' | 'やや不足' | '不足'
  comment: string
}

export interface ApplicationEvaluation {
  criteria: EvaluationCriterionResult[]
  overallComment: string
}

// 小規模事業者持続化補助金の公募要領に明記されている4つの審査の観点。
// 順序はそのままAIへの出力順の指示にも使う。
export const EVALUATION_CRITERIA_LABELS = [
  '①自社の経営状況分析の妥当性',
  '②経営方針・目標と今後のプランの適切性',
  '③補助事業計画の有効性（売上高・売上総利益の増加を目指すものか）',
  '④積算の透明・適切性',
] as const

const SYSTEM_PROMPT =
  'あなたは小規模事業者持続化補助金の審査員の視点でチェックを行うアシスタントです。' +
  '渡された申請書の下書き文章（経営計画・補助事業計画）と経費の概要をもとに、' +
  '次の4つの審査の観点それぞれについて、記載内容がどの程度満たしているかを判定してください: ' +
  EVALUATION_CRITERIA_LABELS.join(' / ') +
  '。判定は「十分」「やや不足」「不足」のいずれかとし、なぜその判定なのか、' +
  '記載内容の具体的にどこが良い・足りないのかを、担当スタッフが次に何を直せばよいか分かるように' +
  '日本語でコメントしてください。厳しすぎず、しかし甘すぎない実務的な審査官の視点で評価すること。' +
  '4項目に加えて、全体の総評も1つ書いてください。'

const EVAL_TOOL: Anthropic.Tool = {
  name: 'record_evaluation',
  description: '審査の観点4項目それぞれの判定・コメントと、全体の総評を報告する',
  input_schema: {
    type: 'object',
    properties: {
      criteria: {
        type: 'array',
        description: '4つの審査観点について、EVALUATION_CRITERIA_LABELSと同じ順番・同じ文言のlabelで報告する',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            verdict: { type: 'string', enum: ['十分', 'やや不足', '不足'] },
            comment: { type: 'string', description: '判定理由と改善アドバイスを150文字程度で' },
          },
          required: ['label', 'verdict', 'comment'],
        },
      },
      overallComment: { type: 'string', description: '全体を通した総評を150文字程度で' },
    },
    required: ['criteria', 'overallComment'],
  },
}

/** 下書き文章と経費概要をもとに、審査の観点ごとの充足度をAIにチェックさせる */
export async function evaluateApplicationDraft(draftText: string, expenseSummary: string): Promise<ApplicationEvaluation> {
  const userContent =
    `【申請書の下書き文章】\n${draftText}\n\n【経費の概要】\n${expenseSummary || '（未入力）'}`

  const response = await getClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EVAL_TOOL],
    tool_choice: { type: 'tool', name: EVAL_TOOL.name },
    messages: [{ role: 'user', content: userContent }],
  })

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === EVAL_TOOL.name,
  )
  if (!toolBlock) {
    throw new Error('審査基準のチェックに失敗しました')
  }

  const parsed = toolBlock.input as Partial<ApplicationEvaluation>
  return {
    criteria: parsed.criteria ?? [],
    overallComment: parsed.overallComment ?? '',
  }
}
