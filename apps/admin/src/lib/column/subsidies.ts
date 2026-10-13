import { JIZOKUKA_FACTS } from './facts/jizokuka'
import { SHINMONO_FACTS } from './facts/shinmono'

// コラムを自動生成できる補助金。「事実の根拠(facts)」がある補助金だけを書く。
// 省力化投資補助金・事業承継M&A補助金・AI関連は、公募要領などの根拠テキストを足したら追加する。
import type { ColumnSubsidyInput } from '@salud/ai'
export type ColumnSubsidy = ColumnSubsidyInput

export const COLUMN_SUBSIDIES: ColumnSubsidy[] = [
  {
    key: 'jizokuka',
    name: '小規模事業者持続化補助金（一般型 通常枠・第20回）',
    facts: JIZOKUKA_FACTS,
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
]
