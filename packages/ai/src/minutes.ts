import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export interface MeetingAnalysis {
  summary: string
  decisions: string[]
  actionItems: string[]
}

const SYSTEM_PROMPT =
  'あなたは会議の議事録を分析するアシスタントです。渡された議事録テキスト(文字起こしまたはメモ)から、' +
  '要約・決定事項・アクションアイテムを日本語で抽出してください。' +
  '出力は次のJSON形式のみとし、前後に説明文やマークダウンのコードブロック記法を付けないこと: ' +
  '{"summary": string, "decisions": string[], "actionItems": string[]}'

export async function analyzeMeetingMinutes(text: string): Promise<MeetingAnalysis> {
  const response = await getClient().messages.create({
    model: 'claude-opus-5',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text }],
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

  const parsed = JSON.parse(jsonText) as Partial<MeetingAnalysis>
  return {
    summary: parsed.summary ?? '',
    decisions: parsed.decisions ?? [],
    actionItems: parsed.actionItems ?? [],
  }
}
