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
  // 売上見込み（現状→1〜3年後）。効果の試算・経営目標の数値に使う
  salesForecast?: string
  // 業務効率化の取組（機械装置・ソフトウェア等の導入）を含む事業か。true のとき 3-1・3-2 を生成する
  includeEfficiency?: boolean
  // ヒアリングシート v2「補足情報」由来（任意）
  schedule?: string
  efficiencyItems?: string
  efficiencyCurrent?: string
  efficiencyEffect?: string
  orderChannels?: string
  marketingIssues?: string
  paymentTerms?: string
  expansionPlans?: string
  salesTargetBasis?: string
  profitTarget?: string
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
  initiativesSummary: string
  initiatives: string
  schedule: string
  efficiencyBackground: string
  efficiencySummary: string
  efficiencyDetail: string
  efficiencySchedule: string
  effect: string
  effectEstimate: string
}

// 実際の電子申請ポータル（jizokuka-portal.info）の入力画面キャプチャと、採択された申請書（様式2）の
// 項目構成に合わせている。数値のみのセクション（1-2売上・利益の状況）と
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
  initiativesSummary: '【補助事業計画】2-3．具体的な取組（概要）',
  initiatives: '【補助事業計画】2-3．具体的な取組（詳細）',
  schedule: '【補助事業計画】2-3．スケジュール',
  efficiencyBackground: '【補助事業計画】3-1．業務効率化の取組：背景・目的',
  efficiencySummary: '【補助事業計画】3-2．業務効率化の取組：具体的な取組（概要）',
  efficiencyDetail: '【補助事業計画】3-2．業務効率化の取組：具体的な取組（詳細）',
  efficiencySchedule: '【補助事業計画】3-2．業務効率化の取組：スケジュール',
  effect: '【補助事業計画】4-1．取組の効果',
  effectEstimate: '【補助事業計画】4-2．効果の試算',
}

// 業務効率化の取組（様式2 補助事業計画の3）。該当しない事業では生成しない
const EFFICIENCY_KEYS: (keyof ApplicationDraft)[] = [
  'efficiencyBackground', 'efficiencySummary', 'efficiencyDetail', 'efficiencySchedule',
]

// 旧版で保存済みの下書きのタイトル（再生成時にキーへ戻すため）
const LEGACY_LABELS: Record<string, keyof ApplicationDraft> = {
  '【補助事業計画】2-3．具体的な取組': 'initiatives',
}

const EVALUATION_CRITERIA =
  '審査では次の4点が重視される: ' +
  '①自社の経営状況分析の妥当性 ②経営方針・目標と今後のプランの適切性 ' +
  '③補助事業計画の有効性（売上高・売上総利益の増加を目指すものか） ④積算の透明・適切性。'

// 採択された申請書の「構成と書き方」の型。固有の事実（社名・地名・金額・取引先）は一切引き継がない。
const WRITING_STYLE =
  '【書き方の型】' +
  '(1)一貫したストーリー: 申請書全体を貫く2〜3本の柱（例:「新規顧客の獲得」「作業の効率化」「収益・資金繰りの安定」）を決め、' +
  '経営課題→市場・顧客ニーズ→強み→経営方針→今後のプラン→補助事業の取組→効果の順に、同じ柱で対応させること。' +
  '課題①②③に対して取組①②③、効果①②③が対応しているのが理想。セクションごとに別々の話をしない。' +
  '(2)文体は「〜である」「〜している」の常体で言い切る（「〜と考えている」「〜したい」は避ける）。' +
  '課題・ニーズ・強みなど複数項目を挙げる箇所は「①短い見出し」の直後に、理由・根拠を2〜4文で続ける。' +
  '(3)数字で具体的に書く: 売上構成の割合、取引・顧客の比率、売上目標（現在比◯％）、利益率、作業時間の削減率など、' +
  'ヒアリング内容にある数字を使う。ヒアリングにない数字は絶対に創作せず、必要な箇所には「【要確認：◯◯】」と書いて担当者に確認を促す。' +
  '(4)現状の問題点は具体的に書く: 「弱い」「不十分」で終わらず、何がどう機能していないかを、ヒアリング内容の範囲で具体的に書く。' +
  '(5)取組の詳細は「現状の課題（箇条書き）→本事業での解決策→期待される結果」の流れで書く。' +
  '(6)市場の動向には、公的統計など信頼できる出典名（例: 総務省「住宅・土地統計調査」）を添えてよいが、' +
  '確証のない数値やURLは書かず、必要なら「【要確認：出典】」とする。' +
  '(7)目標・効果は、現状→1年後→3年後の売上と現在比（％）、利益率の改善など、検証できる数値で示す。'

const SYSTEM_PROMPT =
  'あなたは小規模事業者持続化補助金の申請書作成を支援する行政書士アシスタントです。' +
  'ヒアリング内容（企業概要・強み弱み・市場動向・顧客ニーズ・経営方針・補助事業の狙い）をもとに、' +
  '経営計画書・補助事業計画書（様式2）の下書き文章を日本語で作成してください。' +
  EVALUATION_CRITERIA + ' ' + WRITING_STYLE +
  ' 誇張や事実の捏造はせず、ヒアリング内容の範囲で具体的かつ説得力のある文章にすること。' +
  '文章はそのまま電子申請システムにコピー＆ペーストされるため、Markdown記法（#・**・表の罫線）は使わず、' +
  '番号付き項目（①②③）と「・」の箇条書きのみ使ってよい' +
  '（「補助事業で行う事業名」のみ30文字以内の名詞的な短いタイトルとすること）。'

function sectionSchema(label: string, hint: string) {
  return { type: 'string' as const, description: `${label} の本文。${hint}` }
}

const SECTION_HINTS: Record<keyof ApplicationDraft, string> = {
  overview: '事業内容・売上構成・特徴（受注構造や代表者の経歴など）・現在の状況を含め400〜600文字程度',
  issues: '課題を①②③の3点で、各100〜150文字程度',
  marketTrends: '市場の動向を①②の2点で、各150〜200文字程度。公的統計の出典名を添えてよい',
  customerNeeds: '顧客ニーズを①②③の3点で、各100〜150文字程度',
  strength: '強みを①②③の3点で、各150〜250文字程度（根拠・実績を添える）',
  weakness: '弱みを2点程度、各100〜150文字程度',
  policyGoal: '経営方針（200〜300文字）と、現状→1年後→3年後の売上目標（現在比％）を含む目標',
  futurePlan: '柱ごとに①②③で、各取組を「・」の箇条書きで具体的に',
  projectName: '30文字以内、体言止めの短いタイトル',
  projectOverview: '本事業の全体像を300〜400文字程度',
  background: '経営課題・市場動向を踏まえ、なぜ今この事業を行うのかを300〜400文字程度',
  initiativesSummary: '取組を①②の1〜2行ずつの概要で',
  initiatives: '取組ごとに「現状の課題（具体的な不具合を「・」で）→本事業での解決策→期待される結果」の順で、全体で600〜900文字程度',
  schedule: '取組ごとの実施時期を「取組名：◯月〜◯月」の形で一覧に。時期がヒアリングにない場合は「【要確認：実施時期】」',
  efficiencyBackground: '作業の非効率が生む具体的な問題（時間・人件費・負担）と、導入しないと困る点を300〜400文字程度',
  efficiencySummary: '導入する機械装置・ソフトウェア等を1〜2行で',
  efficiencyDetail: '導入するものごとに「現状→導入による変化→効果」を、全体で400〜600文字程度',
  efficiencySchedule: '導入・習熟・運用開始の時期を「内容：◯月」の形で一覧に。時期がない場合は「【要確認：導入時期】」',
  effect: '効果を①②③④の項目（売上・生産性・利益・資金繰り等）で、各100〜150文字程度',
  effectEstimate: '売上増加効果（現状→1年後→3年後の売上と現在比％）、作業時間の短縮効果、利益率の改善効果を、数値で整理して書く',
}

function draftKeys(includeEfficiency: boolean): (keyof ApplicationDraft)[] {
  return (Object.keys(SECTION_LABELS) as (keyof ApplicationDraft)[]).filter(
    k => includeEfficiency || !EFFICIENCY_KEYS.includes(k),
  )
}

function buildDraftTool(keys: (keyof ApplicationDraft)[]): Anthropic.Tool {
  return {
    name: 'record_draft',
    description: '経営計画書・補助事業計画書の各セクションの下書き本文を構造化して報告する',
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(keys.map(k => [k, sectionSchema(SECTION_LABELS[k], SECTION_HINTS[k])])),
      required: keys,
    },
  }
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
    input.topServices ? `利益に貢献している主力サービス: ${input.topServices}` : '',
    input.customerSegments ? `主な顧客層: ${input.customerSegments}` : '',
    input.salesPlan ? `補助事業による売上の見込み: ${input.salesPlan}` : '',
    input.salesForecast ? `売上見込み（現状→1〜3年後）: ${input.salesForecast}` : '',
    input.appealPoints ? `補助事業のこだわりポイント（独自の工夫）: ${input.appealPoints}` : '',
    input.expenseSummary ? `補助対象経費の予定: ${input.expenseSummary}` : '',
    input.schedule ? `補助事業の実施時期: ${input.schedule}` : '',
    input.efficiencyItems ? `業務効率化: 導入するもの: ${input.efficiencyItems}` : '',
    input.efficiencyCurrent ? `業務効率化: 現在の作業方法と非効率な点: ${input.efficiencyCurrent}` : '',
    input.efficiencyEffect ? `業務効率化: 導入後に変わること・見込み: ${input.efficiencyEffect}` : '',
    input.orderChannels ? `受注・集客経路の比率: ${input.orderChannels}` : '',
    input.marketingIssues ? `現在のホームページ・集客手段の問題点: ${input.marketingIssues}` : '',
    input.paymentTerms ? `入金までの期間（回収サイト）: ${input.paymentTerms}` : '',
    input.expansionPlans ? `事務所・設備・人員の計画: ${input.expansionPlans}` : '',
    input.salesTargetBasis ? `売上目標の根拠: ${input.salesTargetBasis}` : '',
    input.profitTarget ? `利益率の目標: ${input.profitTarget}` : '',
  ].filter(Boolean).join('\n')
}

/** ヒアリング内容から全セクションの初稿を一括生成する */
export async function generateApplicationDraft(input: ApplicationHearingInput): Promise<Partial<ApplicationDraft>> {
  const keys = draftKeys(!!input.includeEfficiency)
  const tool = buildDraftTool(keys)
  const response = await getClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: buildHearingText(input) }],
  })

  if (response.stop_reason === 'max_tokens') {
    throw new Error('AIの応答が長すぎて途中で切れました。もう一度お試しください')
  }

  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === tool.name,
  )
  if (!toolBlock) {
    throw new Error('AI下書きの生成に失敗しました')
  }

  const parsed = toolBlock.input as Partial<ApplicationDraft>
  const draft: Partial<ApplicationDraft> = {}
  for (const key of keys) draft[key] = parsed[key] ?? ''
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

/** 保存済みの下書きタイトル（旧版を含む）から、セクションのキーを引く */
export function applicationSectionKeyFromTitle(title: string): keyof ApplicationDraft | undefined {
  const hit = (Object.entries(SECTION_LABELS) as [keyof ApplicationDraft, string][]).find(([, l]) => l === title)
  return hit?.[0] ?? LEGACY_LABELS[title]
}

export { draftKeys as applicationDraftKeys }
