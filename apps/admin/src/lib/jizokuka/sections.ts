// case_draft_sections.title には application.ts の SECTION_LABELS がそのまま入る。
// 補助事業計画パート（様式2後半）は '【補助事業計画】' プレフィックス付きで区別している。
const PROJECT_PREFIX = '【補助事業計画】'

export function splitSectionTitle(title: string): { group: string; label: string } {
  if (title.startsWith(PROJECT_PREFIX)) {
    return { group: '補助事業計画（様式2）', label: title.slice(PROJECT_PREFIX.length) }
  }
  return { group: '経営計画（様式2）', label: title }
}
