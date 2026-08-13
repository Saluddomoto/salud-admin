import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export interface LineTaskCandidate {
  isTask: boolean
  title: string | null
  dueDate: string | null // 'YYYY-MM-DD' | null
}

const SYSTEM_PROMPT =
  '社内グループLINEの1件の発言を見て、「対応すべきタスク・宿題・やるべきこと」が含まれているかを判定するアシスタントです。' +
  '雑談・相槌・情報共有だけの発言・すでに完了した報告は false としてください。' +
  '依頼・確認・提出・準備・連絡など、誰かが後で行うべき具体的な行動が読み取れる場合のみ true にしてください。' +
  '出力は次のJSON形式のみとし、前後に説明文やマークダウンのコードブロック記法を付けないこと: ' +
  '{"is_task": boolean, "title": string|null, "due_date": string|null}。' +
  'is_task が true の場合、title は15〜30字程度の簡潔な日本語のタスク名にすること。' +
  'due_date は発言中に日付や期限の言及があれば YYYY-MM-DD 形式で、無ければ null にすること。'

/** LINEグループの1発言を見て、タスク候補かどうかをAI(Haiku)で判定する */
export async function classifyLineMessageForTask(
  text: string,
  context: { senderName: string; groupName: string | null; today: string },
): Promise<LineTaskCandidate> {
  const userContent =
    `今日の日付: ${context.today}\n` +
    `グループ名: ${context.groupName ?? '不明'}\n` +
    `発言者: ${context.senderName}\n` +
    `発言内容: ${text}`

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    return { isTask: false, title: null, dueDate: null }
  }

  const jsonText = textBlock.text
    .trim()
    .replace(/^```(json)?/, '')
    .replace(/```$/, '')
    .trim()

  try {
    const parsed = JSON.parse(jsonText) as { is_task?: boolean; title?: string | null; due_date?: string | null }
    return {
      isTask: parsed.is_task === true,
      title: parsed.title ?? null,
      dueDate: parsed.due_date ?? null,
    }
  } catch {
    return { isTask: false, title: null, dueDate: null }
  }
}
