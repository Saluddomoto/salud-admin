import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export interface ApplicationHearingInput {
  businessName: string
  representative: string
  industry: string
  employeeCount: number
  recentRevenue: number
  swotStrength: string
  swotWeakness: string
  swotOpportunity: string
  swotThreat: string
  marketTrends: string
  customerNeeds: string
  businessPolicyGoal: string
  futurePlan: string
  subsidyGoal: string
  // ヒアリングシート由来（任意）
  topServices?: string
  customerSegments?: string
  salesPlan?: string
  appealPoints?: string
  expenseSummary?: string
}

export interface ApplicationDraft {
  overview: string
  issues: string
  marketTrends: string
  customerNeeds: string
  strength: string
  weakness: string
  policyGoal: string
  futurePlan: string
  projectName: string
  projectOverview: string
  background: string
  initiatives: string
  effect: string
}

// 実際の電子申請ポータル（jizokuka-portal.info）の入力画面キャプチャで確認した
// 様式2（経営計画兼補助事業計画①）の項目構成に合わせている。
// 数値のみのセクション（1-2売上・利益の状況、4-2効果の試算、事業スケジュール表）と
// 様式3（経費明細表・資金調達方法、金額ベース）はAI生成の対象外。
const SECTION_LABELS: Record<keyof ApplicationDraft, string> = {
  overview: '1-1．自社の概要',
  issues: '1-3．経営課題',
  marketTrends: '2-1．市場の動向',
  customerNeeds: '2-2．顧客ニーズ',
  strength: '3．自社の強み',
  weakness: '3．自社の弱み',
  policyGoal: '4-1．経営方針・目標',
  futurePlan: '4-2．今後のプラン',
  projectName: '【補助事業計画】1．補助事業で行う事業名（30文字以内）',
  projectOverview: '【補助事業計画】2-1．事業の概要',
  background: '【補助事業計画】2-2．背景・目的',
  initiatives: '【補助事業計画】2-3．具体的な取組',
  effect: '【補助事業計画】4-1．取組の効果',
}

const EVALUATION_CRITERIA =
  '審査では次の4点が重視される: ' +
  '①自社の経営状況分析の妥当性 ②経営方針・目標と今後のプランの適切性 ' +
  '③補助事業計画の有効性（売上高・売上総利益の増加を目指すものか） ④積算の透明・適切性。'

const SYSTEM_PROMPT =
  'あなたは小規模事業者持続化補助金の申請書作成を支援する行政書士アシスタントです。' +
  'ヒアリング内容（企業概要・強み弱み・市場動向・顧客ニーズ・経営方針・補助事業の狙い）をもとに、' +
  '経営計画書・補助事業計画書（様式2）の下書き文章を日本語で作成してください。' +
  EVALUATION_CRITERIA +
  ' 誇張や事実の捏造はせず、ヒアリング内容の範囲で具体的かつ説得力のある文章にすること。' +
  '文章はそのまま電子申請システムにコピー＆ペーストされるため、見出しや箇条書き記号を付けず本文のみを書くこと' +
  '（「補助事業で行う事業名」のみ30文字以内の名詞的な短いタイトルとすること）。'

function sectionSchema(label: string, hint: string) {
  return { type: 'string' as const, description: `${label} の本文。${hint}` }
}

const DRAFT_TOOL: Anthropic.Tool = {
  name: 'record_draft',
  description: '経営計画書・補助事業計画書の各セクションの下書き本文を構造化して報告する',
  input_schema: {
    type: 'object',
    properties: {
      overview: sectionSchema(SECTION_LABELS.overview, '沿革・事業内容を含め300〜400文字程度'),
      issues: sectionSchema(SECTION_LABELS.issues, '200〜300文字程度'),
      marketTrends: sectionSchema(SECTION_LABELS.marketTrends, '200〜300文字程度'),
      customerNeeds: sectionSchema(SECTION_LABELS.customerNeeds, '200〜300文字程度'),
      strength: sectionSchema(SECTION_LABELS.strength, '200〜300文字程度'),
      weakness: sectionSchema(SECTION_LABELS.weakness, '150〜250文字程度'),
      policyGoal: sectionSchema(SECTION_LABELS.policyGoal, '経営方針と具体的な数値目標を含め300文字程度'),
      futurePlan: sectionSchema(SECTION_LABELS.futurePlan, '経営方針を実現する具体策を300文字程度'),
      projectName: sectionSchema(SECTION_LABELS.projectName, '30文字以内、体言止めの短いタイトル'),
      projectOverview: sectionSchema(SECTION_LABELS.projectOverview, '300〜400文字程度'),
      background: sectionSchema(SECTION_LABELS.background, '経営課題・市場動向を踏まえ300〜400文字程度'),
      initiatives: sectionSchema(SECTION_LABELS.initiatives, '具体的な取組内容を400〜500文字程度'),
      effect: sectionSchema(SECTION_LABELS.effect, '本事業により期待される効果を250〜350文字程度'),
    },
    required: Object.keys(SECTION_LABELS),
  },
}

function buildHearingText(input: ApplicationHearingInput): string {
  return [
    `事業者名: ${input.businessName}（代表: ${input.representative}）`,
    `業種: ${input.industry} / 従業員数: ${input.employeeCount}名 / 直近売上: ${input.recentRevenue.toLocaleString()}円`,
    `強み: ${input.swotStrength}`,
    `弱み: ${input.swotWeakness}`,
    `機会: ${input.swotOpportunity}`,
    `脅威: ${input.swotThreat}`,
    `市場の動向: ${input.marketTrends}`,
    `顧客ニーズ: ${input.customerNeeds}`,
    `経営方針・目標: ${input.businessPolicyGoal}`,
    `今後のプラン: ${input.futurePlan}`,
    `補助事業で目指すこと: ${input.subsidyGoal}`,
  ].join('\n')
}

/** ヒアリング内容から全セクションの初稿を一括生成する */
export async function generateApplicationDraft(input: ApplicationHearingInput): Promise<ApplicationDraft> {
  const response = await getClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [DRAFT_TOOL],
    tool_choice: { type: 'tool', name: DRAFT_TOOL.name },
    messages: [{ role: 'user', content: buildHearingText(input) }],
  })

  if (response.stop_reason === 'max_tokens') {
    throw new Error('AIの応答が長すぎて途中で切れました。もう一度お試しください')
  }

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === DRAFT_TOOL.name,
  )
  if (!toolBlock) {
    throw new Error('AI下書きの生成に失敗しました')
  }

  const parsed = toolBlock.input as Partial<ApplicationDraft>
  const draft = {} as ApplicationDraft
  for (const key of Object.keys(SECTION_LABELS) as (keyof ApplicationDraft)[]) {
    draft[key] = parsed[key] ?? ''
  }
  return draft
}

const SECTION_TOOL: Anthropic.Tool = {
  name: 'record_section',
  description: '指示を反映した1セクション分の本文を報告する',
  input_schema: {
    type: 'object',
    properties: {
      body: { type: 'string', description: '修正後の本文（見出し・箇条書き記号なし）' },
    },
    required: ['body'],
  },
}

/** 1セクションだけを、担当者の追加指示を反映して再生成する */
export async function regenerateApplicationSection(
  input: ApplicationHearingInput,
  sectionKey: keyof ApplicationDraft,
  currentBody: string,
  instruction: string,
): Promise<string> {
  const userContent =
    `${buildHearingText(input)}\n\n` +
    `対象セクション: ${SECTION_LABELS[sectionKey]}\n` +
    `現在の本文:\n${currentBody}\n\n` +
    `担当者からの修正指示: ${instruction}`

  const response = await getClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [SECTION_TOOL],
    tool_choice: { type: 'tool', name: SECTION_TOOL.name },
    messages: [{ role: 'user', content: userContent }],
  })

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === SECTION_TOOL.name,
  )
  if (!toolBlock) {
    throw new Error('AI再生成に失敗しました')
  }

  const parsed = toolBlock.input as Partial<{ body: string }>
  return parsed.body ?? currentBody
}

export const APPLICATION_SECTION_LABELS = SECTION_LABELS
export const APPLICATION_SECTION_ORDER = Object.keys(SECTION_LABELS) as (keyof ApplicationDraft)[]
