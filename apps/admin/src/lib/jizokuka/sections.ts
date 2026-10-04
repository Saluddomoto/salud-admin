// case_draft_sections.title には application.ts の SECTION_LABELS がそのまま入る。
// 補助事業計画パート（様式2後半）は '【補助事業計画】' プレフィックス付きで区別している。
const PROJECT_PREFIX = '【補助事業計画】'

export function splitSectionTitle(title: string): { group: string; label: string } {
  if (title.startsWith(PROJECT_PREFIX)) {
    return { group: '補助事業計画（様式2）', label: title.slice(PROJECT_PREFIX.length) }
  }
  return { group: '経営計画（様式2）', label: title }
}

// 採択申請書の構成に合わせて後から追加したセクション（コピー用テキスト画面で赤く表示する）
const ADDED_LABELS = new Set([
  '2-3．具体的な取組（概要）',
  '2-3．スケジュール',
  '3-1．業務効率化の取組：背景・目的',
  '3-2．業務効率化の取組：具体的な取組（概要）',
  '3-2．業務効率化の取組：具体的な取組（詳細）',
  '3-2．業務効率化の取組：スケジュール',
  '4-2．効果の試算',
])

export function isAddedSection(title: string): boolean {
  return ADDED_LABELS.has(splitSectionTitle(title).label)
}

/** 本文中の「【要確認：◯◯】」（ヒアリングで不足していた情報）を分割する */
export function splitConfirmMarkers(body: string): { text: string; confirm: boolean }[] {
  return body
    .split(/(【要確認[^】]*】)/)
    .filter(Boolean)
    .map(text => ({ text, confirm: text.startsWith('【要確認') }))
}
