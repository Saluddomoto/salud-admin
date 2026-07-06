// LINE メッセージから予定を抽出するパーサー
// 例: 「予定 7/10 14:00 山田製作所 打ち合わせ」
//     「MTG 7月10日 14時〜15時半 テックス商談」
//     「7/10 14:00-15:30 山田製作所」

export type ParsedEvent = {
  title: string
  event_date: string // YYYY-MM-DD
  start_time: string // HH:MM
  end_time: string   // HH:MM
  category: 'sales' | 'meeting' | 'deadline' | 'internal'
}

const pad = (n: number) => String(n).padStart(2, '0')

export function parseEventMessage(text: string, now = new Date()): ParsedEvent | null {
  // 先頭のキーワード（予定 / MTG など）は任意
  let rest = text.replace(/^(予定|MTG|ミーティング|mtg)[\s　:：]*/i, '').trim()

  const dateMatch = rest.match(/(\d{1,2})[\/月](\d{1,2})日?/)
  if (!dateMatch) return null
  rest = rest.replace(dateMatch[0], ' ')

  const timeMatch = rest.match(
    /(\d{1,2})(?::(\d{2})|時(?:(\d{2})分|半)?)\s*(?:[-〜~‐–から]+\s*(\d{1,2})(?::(\d{2})|時(?:(\d{2})分|半)?))?/,
  )
  if (!timeMatch) return null
  rest = rest.replace(timeMatch[0], ' ')

  const month = Number(dateMatch[1])
  const day   = Number(dateMatch[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  // 年の推定: 60日以上前の日付なら来年の予定とみなす
  let year = now.getFullYear()
  const candidate = new Date(year, month - 1, day)
  if (candidate.getTime() < now.getTime() - 60 * 86_400_000) year += 1

  const startHour = Number(timeMatch[1])
  const startMin  = timeMatch[2] != null ? Number(timeMatch[2])
                  : timeMatch[3] != null ? Number(timeMatch[3])
                  : timeMatch[0].includes('半') && timeMatch[4] == null ? 30
                  : 0
  if (startHour > 23 || startMin > 59) return null

  let endHour: number
  let endMin: number
  if (timeMatch[4] != null) {
    endHour = Number(timeMatch[4])
    endMin  = timeMatch[5] != null ? Number(timeMatch[5])
            : timeMatch[6] != null ? Number(timeMatch[6])
            : /[〜~\-‐–から]+.*半/.test(timeMatch[0]) ? 30
            : 0
  } else {
    endHour = Math.min(startHour + 1, 23)
    endMin  = startHour + 1 > 23 ? 59 : startMin
  }
  if (endHour > 23 || endMin > 59) return null

  const title = rest.replace(/[\s　]+/g, ' ').trim() || '打ち合わせ'

  const category: ParsedEvent['category'] =
    /商談|営業/.test(title)        ? 'sales'    :
    /締切|期限|〆切/.test(title)   ? 'deadline' :
    /社内|朝礼|定例|会議/.test(title) ? 'internal' :
    'meeting'

  return {
    title,
    event_date: `${year}-${pad(month)}-${pad(day)}`,
    start_time: `${pad(startHour)}:${pad(startMin)}`,
    end_time:   `${pad(endHour)}:${pad(endMin)}`,
    category,
  }
}
