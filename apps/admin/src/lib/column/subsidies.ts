import { JIZOKUKA_FACTS } from './facts/jizokuka'
import { SHINMONO_FACTS } from './facts/shinmono'
import { SHORYOKUKA_FACTS } from './facts/shoryokuka'

// コラムを自動生成できる補助金。「事実の根拠(facts)」がある補助金だけを書く。
// 省力化投資補助金・事業承継M&A補助金・AI関連は、公募要領などの根拠テキストを足したら追加する。
import type { ColumnSubsidyInput } from '@salud/ai'
export type ColumnSubsidy = ColumnSubsidyInput

export const COLUMN_SUBSIDIES: ColumnSubsidy[] = [
  {
    key: 'jizokuka',
    name: '小規模事業者持続化補助金（一般型 通常枠・第20回）',
    facts: JIZOKUKA_FACTS,
    practicalNotes: [
      '・事業支援計画書（様式4）の発行にあたっての面談は、商工会地区だけでなく、商工会議所地区でも、事前の相談や面談を求められることが多い（公募要領には商工会議所地区の面談の記載はない）。',
      '・面談はオンラインで対応する窓口もあるが、対応は地域（窓口）によって異なる。早めに地域の窓口へ連絡して確認するよう案内する。',
      '・見積書の取得（見積依頼）は「発注」にあたらない。発注・契約とみなされるのは、注文書の発行や契約の締結など、取引を確定させる行為。どの時点から発注・契約とみなされるか迷う場合は事務局へ確認するよう案内する（公募要領に明記はない）。',
      '・交付決定の日付は公募要領に書かれていない。採択発表から概ね1〜2か月という目安のみで、日程は変わる場合がある、と書く（断定しない）。',
    ].join('\n'),
    sourceLabel: '小規模事業者持続化補助金＜一般型 通常枠＞ 第20回公募 公募要領',
    sourceUrl: 'https://salud-web.jp/jizokuka/',
    checkedAt: '2026-10-08',
    relatedPath: '/jizokuka/',
  },
  {
    key: 'shinmono',
    name: '新事業進出・ものづくり商業サービス補助金（第1回公募）',
    facts: SHINMONO_FACTS,
    sourceLabel: '新事業進出・ものづくり商業サービス補助金 公募要領（第1回・1.3版、令和8年9月）',
    sourceUrl: 'https://shinjigyou-monodukuri.smrj.go.jp/',
    checkedAt: '2026-10-12',
    relatedPath: '/shinjigyo-monodukuri-hojokin-1kai/',
  },
  {
    key: 'shoryokuka',
    name: '中小企業省力化投資補助金（一般型・第8回公募）',
    facts: SHORYOKUKA_FACTS,
    practicalNotes: '・申請締切日は公募要領に記載がない（「追ってHPでお知らせ」）。締切日は書かず、公式サイトで確認するよう案内する。',
    sourceLabel: '中小企業省力化投資補助事業（一般型）公募要領（第8回公募・2026年8月、9月18日改訂）',
    sourceUrl: 'https://shoryokuka.smrj.go.jp/ippan/',
    checkedAt: '2026-10-15',
    relatedPath: '/',
  },
]
