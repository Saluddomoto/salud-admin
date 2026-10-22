import Anthropic from '@anthropic-ai/sdk'
import { recordUsage } from './usage'

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export type MemoTarget = 'hearing' | 'basic'

/** text=文章 / number=数値 / services=主力商品・サービスの表（1行ずつ「名前｜売上比率%｜単価」） */
export type MemoKind = 'text' | 'number' | 'services'

export interface MemoField {
  target: MemoTarget
  key: string
  label: string
  hint: string
  kind?: MemoKind
}

// ヒアリングメモの振り分け先（日付・実施スケジュール・売上効果の表は誤入力を避けるため対象外）
export const MEMO_FIELDS: MemoField[] = [
  { target: 'hearing', key: 'employee_count', label: '従業員数', hint: '従業員数（人、数値のみ）', kind: 'number' },
  { target: 'hearing', key: 'top_services', label: '主力商品・サービス', hint: '主力の商品・サービス。名前・売上比率(%)・単価(円)', kind: 'services' },
  { target: 'hearing', key: 'gross_margin_pct', label: '粗利率(%)', hint: '粗利率（%、数値のみ）', kind: 'number' },
  { target: 'hearing', key: 'growth_pct', label: '売上の伸び率(%)', hint: '見込む売上の伸び率（%、数値のみ）', kind: 'number' },
  { target: 'hearing', key: 'target_sales_y1', label: '1年後の売上目標', hint: '1年後の目標売上（円、数値のみ）', kind: 'number' },
  { target: 'hearing', key: 'target_sales_y3', label: '3年後の売上目標', hint: '3年後の目標売上（円、数値のみ）', kind: 'number' },
  { target: 'hearing', key: 'target_sales_basis', label: '売上目標の根拠', hint: '目標売上の算出根拠' },
  { target: 'hearing', key: 'profit_target', label: '利益目標', hint: '利益の目標' },
  { target: 'hearing', key: 'efficiency_items', label: '業務効率化の内容', hint: 'ITツール導入など業務効率化の取り組み' },
  { target: 'hearing', key: 'efficiency_current', label: '業務効率化の現状', hint: '効率化前の現状・手作業の状況' },
  { target: 'hearing', key: 'efficiency_effect', label: '業務効率化の効果', hint: '効率化で見込む効果' },
  { target: 'hearing', key: 'market_sources', label: '市場データの出典', hint: '市場情報の出典・参考資料' },
  { target: 'hearing', key: 'attachments_note', label: '添付資料メモ', hint: '提出・添付予定の資料' },
  { target: 'basic', key: 'past_adoption_summary', label: '過去の採択実績', hint: '過去の補助金の採択・申請歴' },
  { target: 'basic', key: 'policy_points', label: '政策加点の該当', hint: '賃上げ・事業承継などの加点項目の該当' },
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
  kind: MemoKind
}

const SYSTEM_PROMPT =
  '小規模事業者持続化補助金の申請支援で、担当者がヒアリング中に取った自由記述メモを、申請書作成ツールの入力項目へ振り分けるアシスタントです。' +
  '次の項目一覧に、メモの内容をできるだけ漏らさず振り分けてください。メモの各文を順に見て、関係しそうな項目すべてに入れること（1つの内容が複数の項目に関係するなら重複して入れてよい）。' +
  '例: こだわり・強みは強みに、困りごとは弱みに、客層は顧客層に、数字は数値項目に、将来の話は経営方針・今後のプランに。\n' +
  MEMO_FIELDS.map(f => `- ${f.key}（${f.label}）: ${f.hint}`).join('\n') +
  '\n厳守事項: メモに書かれていない事実・数字・固有名詞を絶対に補わない。推測で埋めない（これ以外は積極的に振り分ける）。' +
  '数値項目は数値のみ、top_services は {name, ratio_pct, unit_price} の配列（不明な数値は省略）。' +
  '値はメモの表現を活かして簡潔な日本語に整える（箇条書き可）。1つの項目に入れるべき内容が複数箇所に散らばっていれば統合する。' +
  'どの項目にも本当に当てはまらない内容だけを unmatched に原文に近い形で入れる。結果は必ず record_fields ツールで返すこと。'

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
        properties: Object.fromEntries(MEMO_FIELDS.map(f => [f.key,
          f.kind === 'number' ? { type: 'number', description: f.hint }
          : f.kind === 'services' ? {
            type: 'array',
            description: f.hint,
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, ratio_pct: { type: 'number' }, unit_price: { type: 'number' } },
              required: ['name'],
            },
          }
          : { type: 'string', description: f.hint },
        ])),
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
  recordUsage('claude-sonnet-5', response.usage)
  const block = response.content.find(b => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new Error('AIの応答が空でした')
  const parsed = block.input as { fields?: Record<string, unknown>; unmatched?: unknown }

  const proposals: MemoProposal[] = []
  for (const f of MEMO_FIELDS) {
    const v = parsed.fields?.[f.key]
    const kind = f.kind ?? 'text'
    let value = ''
    if (kind === 'number') {
      if (typeof v === 'number' && Number.isFinite(v)) value = String(v)
    } else if (kind === 'services') {
      if (Array.isArray(v)) {
        value = v
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as { name?: unknown }).name === 'string')
          .map(x => `${x.name}｜${typeof x.ratio_pct === 'number' ? x.ratio_pct : ''}｜${typeof x.unit_price === 'number' ? x.unit_price : ''}`)
          .join('\n')
      }
    } else if (typeof v === 'string') {
      value = v.trim()
    }
    if (value) proposals.push({ target: f.target, key: f.key, label: f.label, value, kind })
  }
  return { proposals, unmatched: typeof parsed.unmatched === 'string' ? parsed.unmatched.trim() : '' }
}
