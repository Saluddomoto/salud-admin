import { Document, Packer, Paragraph, HeadingLevel } from 'docx'
import { splitSectionTitle } from './sections'
import type { JizokukaDraftSection } from './db'

// クライアントへメール添付等で渡せるよう、経営計画/補助事業計画の見出しごとに
// セクション本文をまとめたWord文書を生成する（電子申請ポータルへの入力用の下書き文章そのもの）。
export async function buildApplicationDocxBlob(businessName: string, sections: JizokukaDraftSection[]): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({ text: `${businessName} 補助金申請書 下書き`, heading: HeadingLevel.TITLE }),
  ]

  let lastGroup: string | null = null
  for (const section of sections) {
    const { group, label } = splitSectionTitle(section.title)
    if (group !== lastGroup) {
      children.push(new Paragraph({ text: group, heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }))
      lastGroup = group
    }
    children.push(new Paragraph({ text: label, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }))
    for (const line of section.body.split('\n')) {
      children.push(new Paragraph({ text: line }))
    }
  }

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBlob(doc)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
