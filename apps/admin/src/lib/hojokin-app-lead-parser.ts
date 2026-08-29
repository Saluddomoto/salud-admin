// hojokin-app(補助金の窓口)のリード詳細画面を選択コピー(部分でも画面全体でも)した
// テキストを、customers用のフィールドに振り分けるパーサー。
// hojokin-app側は開発不可のため、画面レイアウトが変わったら随時この一覧を調整する。

const LABELS = [
  '担当者名', 'メールアドレス', '電話番号', '代理店経由',
  '業種', '従業員数', '所在地', '年間売上', '事業内容',
  'プロジェクト内容', 'プロジェクト目的', '希望する補助金区分',
  '登録日時', '更新日時',
  // 長い候補から先にマッチさせるため長さ降順にしておく
].sort((a, b) => b.length - a.length)

const SKIP_LINES = new Set([
  '連絡先情報', '企業情報', 'プロジェクト情報', 'ステータス', 'メモ',
  '詳細情報を表示', 'メモを保存', '← リード一覧に戻る', 'リード一覧に戻る',
  '新規', '削除', '対応中', '完了', 'アーカイブ',
  '補助金の窓口', '管理画面', 'ダッシュボード', 'リード管理', '代理店管理', 'データベース編集',
])

export type ParsedHojokinAppLead = {
  companyName: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  industry: string | null
  employeeCount: number | null
  address: string | null
  notes: string
  selectedSubsidyName: string | null
  viaAgency: boolean
  registeredAtLocal: string | null // datetime-local入力用 "YYYY-MM-DDTHH:mm"
}

function cleanLines(text: string): string[] {
  return text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
}

// 「← リード一覧に戻る」の直後に来る行が会社名（画面全体をコピーした場合のみ拾える）
function extractCompanyName(lines: string[]): string | null {
  const anchorIndex = lines.findIndex(l => l.includes('リード一覧に戻る'))
  if (anchorIndex === -1) return null
  for (let i = anchorIndex + 1; i < Math.min(anchorIndex + 4, lines.length); i++) {
    const line = lines[i]
    if (line && !SKIP_LINES.has(line) && !(LABELS as string[]).includes(line)) return line
  }
  return null
}

function groupByLabel(lines: string[]): Partial<Record<(typeof LABELS)[number], string[]>> {
  const result: Partial<Record<(typeof LABELS)[number], string[]>> = {}
  let current: (typeof LABELS)[number] | null = null

  for (const line of lines) {
    if (SKIP_LINES.has(line)) {
      current = null
      continue
    }
    const matchedLabel = LABELS.find(label => line.startsWith(label))
    if (matchedLabel) {
      current = matchedLabel
      result[current] ??= []
      const rest = line.slice(matchedLabel.length).trim()
      if (rest) result[current]!.push(rest)
      continue
    }
    if (current) result[current]!.push(line)
  }
  return result
}

export function parseHojokinAppLeadText(text: string): ParsedHojokinAppLead {
  const lines = cleanLines(text)
  const companyName = extractCompanyName(lines)
  const g = groupByLabel(lines)

  const employeeRaw = g['従業員数']?.join(' ') ?? ''
  const employeeCount = employeeRaw.match(/(\d+)/)?.[1]
    ? Number(employeeRaw.match(/(\d+)/)![1])
    : null

  const revenueRaw = g['年間売上']?.join(' ') ?? ''
  const agencyLines = g['代理店経由'] ?? []

  const registered = g['登録日時']?.join(' ').match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/)
  const registeredAtLocal = registered
    ? `${registered[1]}-${registered[2]}-${registered[3]}T${registered[4]}:${registered[5]}`
    : null

  const notesBlocks: string[] = []
  if (agencyLines.length) notesBlocks.push(`【代理店経由】\n${agencyLines.join('\n')}`)
  if (employeeRaw) notesBlocks.push(`【従業員数詳細】${employeeRaw}`)
  if (revenueRaw && revenueRaw !== '未入力') notesBlocks.push(`【年間売上】${revenueRaw}`)
  if (g['事業内容']?.length) notesBlocks.push(`【事業内容】\n${g['事業内容'].join('\n')}`)
  if (g['プロジェクト内容']?.length) notesBlocks.push(`【プロジェクト内容】\n${g['プロジェクト内容'].join('\n')}`)
  if (g['プロジェクト目的']?.length) notesBlocks.push(`【プロジェクト目的】${g['プロジェクト目的'].join('・')}`)

  return {
    companyName,
    contactName: g['担当者名']?.join(' ') || null,
    email: g['メールアドレス']?.join(' ') || null,
    phone: g['電話番号']?.join(' ') || null,
    industry: g['業種']?.join(' ') || null,
    employeeCount,
    address: g['所在地']?.join(' ') || null,
    notes: notesBlocks.join('\n\n'),
    selectedSubsidyName: g['希望する補助金区分']?.length ? g['希望する補助金区分'].join('・') : null,
    viaAgency: agencyLines.length > 0,
    registeredAtLocal,
  }
}
