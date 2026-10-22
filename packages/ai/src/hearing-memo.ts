import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export type MemoTarget = 'hearing' | 'basic'

export interface MemoField {
  target: MemoTarget
  key: string
  label: string
  hint: string
}

// ヒアリングメモの振り分け先（テキスト項目のみ。表形式・数値・日付は誤入力を避けるため対象外）
export const MEMO_FIELDS: MemoField[] = [
  { target: 'hearing', key: 'industry', label: '業種', hint: '業種・事業内容の一言' },
  { target: 'hearing', key: 'recent_revenue', label: '直近売上', hint: '直近期の売上（金額・期の表記そのまま）' },
  { target: 'hearing', key: 'customer_segments', label: '顧客層', hint: '主な顧客層・客層' },
  { target: 'hearing', key: 'swot_strength', label: '強み（自社のこだわり）', hint: '強み・こだわり・差別化要素' },
  { target: 'hearing', key: 'swot_weakness', label: '弱み（現在の課題）', hint: '課題・困りごと' },
  { target: 'hearing', key: 'swot_opportunity', label: '機会（プラスの動向）', hint: '追い風・プラスの外部環境' },
  { target: 'hearing', key: 'swot_threat', label: '脅威（マイナスの動向）', hint: '向かい風・マイナスの外部環境' },
  { target: 'hearing', key: 'market_trends', label: '市場の動向', hint: '業界・市場の動き' },
  { target: 'hearing', key: 'business_policy_goal', label: '経営方針・目標', hint: '経営方針・将来の目標' },
  { target: 'hearing', key: 'future_plan', label: '今後のプラン', hint: '今後の取り組み・計画' },
  { target: 'hearing', key: 'subsidy_goal', label: '補助事業で目指すこと', hint: '補助金を使って実現したいこと' },
  { target: 'hearing', key: 'appeal_points', label: 'アピールポイント', hint: '申請書でアピールしたい点' },
  { target: 'hearing', key: 'order_channels', label: '受注・集客経路', hint: '受注経路・集客方法' },
  { target: 'hearing', key: 'marketing_issues', label: '販促上の課題', hint: '集客・販促の課題' },
  { target: 'hearing', key: 'payment_terms', label: '支払条件', hint: '取引条件・支払サイト' },
  { target: 'hearing', key: 'expansion_plans', label: '今後の展開', hint: '新規事業・拡大予定' },
  { target: 'hearing', key: 'founder_background', label: '創業の経緯・代表者経歴', hint: '代表者の経歴・創業のきっかけ' },
  { target: 'hearing', key: 'company_history', label: '沿革', hint: '会社・事業の歴史' },
  { target: 'hearing', key: 'customer_examples', label: '顧客・取引先の例', hint: '具体的な顧客・取引先' },
  { target: 'hearing', key: 'track_record', label: '実績', hint: '受賞歴・販売実績・メディア掲載' },
  { target: 'basic', key: 'website_url', label: 'ホームページURL', hint: 'URL' },
  { target: 'basic', key: 'company_phone', label: '会社電話番号', hint: '電話番号' },
  { target: 'basic', key: 'industry_category', label: '業種区分', hint: '業種区分' },
]

export interface MemoProposal {
  target: MemoTarget
  key: string
  label: string
  value: string
}

const SYSTEM_PROMPT =
  '小規模事業者持続化補助金の申請支援で、担当者がヒアリング中に取った自由記述メモを、申請書作成ツールの入力項目へ振り分けるアシスタントです。' +
  '次の項目一覧のうち、メモに根拠がある項目だけを選び、メモの内容を整理して値にしてください。\n' +
  MEMO_FIELDS.map(f => `- ${f.key}（${f.label}）: ${f.hint}`).join('\n') +
  '\n厳守事項: メモに書かれていない事実・数字・固有名詞を絶対に補わない。推測で埋めない。' +
  '値はメモの表現を活かして簡潔な日本語に整える（箇条書き可）。1つの項目に入れるべき内容が複数箇所に散らばっていれば統合する。' +
  'どの項目にも当てはまらない内容は unmatched に原文に近い形で入れる。結果は必ず record_fields ツールで返すこと。'

// JSON文字列をAIに書かせると引用符や改行で壊れることがあるため、ツール呼び出しで構造化して受け取る
const RECORD_TOOL: Anthropic.Tool = {
  name: 'record_fields',
  description: 'メモを入力項目へ振り分けた結果を記録する',
  input_schema: {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        description: '項目key → 値。メモに根拠がある項目だけ含める',
        properties: Object.fromEntries(MEMO_FIELDS.map(f => [f.key, { type: 'string', description: f.hint }])),
      },
      unmatched: { type: 'string', description: '振り分けできなかった内容（無ければ空文字）' },
    },
    required: ['fields', 'unmatched'],
  },
}

/** ヒアリングメモを、入力項目ごとの提案に振り分ける（反映は呼び出し側で行う） */
export async function sortHearingMemo(memo: string): Promise<{ proposals: MemoProposal[]; unmatched: string }> {
  const response = await getClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    tools: [RECORD_TOOL],
    tool_choice: { type: 'tool', name: 'record_fields' },
    messages: [{ role: 'user', content: `【ヒアリングメモ】\n${memo}` }],
  })
  const block = response.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('AIの応答が空でした')
  const parsed = block.input as { fields?: Record<string, unknown>; unmatched?: unknown }

  const proposals: MemoProposal[] = []
  for (const f of MEMO_FIELDS) {
    const v = parsed.fields?.[f.key]
    if (typeof v === 'string' && v.trim()) {
      proposals.push({ target: f.target, key: f.key, label: f.label, value: v.trim() })
    }
  }
  return { proposals, unmatched: typeof parsed.unmatched === 'string' ? parsed.unmatched.trim() : '' }
}
