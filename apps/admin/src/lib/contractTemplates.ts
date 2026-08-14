// 契約書テンプレート定義。相手先名・住所・代表者名・契約日を差し込んで本文を生成する。
// 自社(Salud)側の情報は固定値。テンプレートを追加する場合はCONTRACT_TEMPLATESに追記する。

export type ContractInput = {
  partnerName: string
  partnerAddress: string
  representativeName: string
  contractDate: string // YYYY-MM-DD
}

export type ContractTemplate = {
  key: string
  label: string
  description: string
  title: string // 文書タイトル（画面・印刷では中央寄せ表示）
  render: (input: ContractInput) => string // タイトルを含まない本文
}

const SALUD_NAME = '株式会社Salud'
const SALUD_ADDRESS = '東京都渋谷区道玄坂1-10-8渋谷道玄坂東急ビル2F-C'
const SALUD_REPRESENTATIVE = '堂本 拓央'

// 西暦 → 令和表記（令和元年=2019年）
export function toReiwa(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const year = d.getFullYear() - 2018
  const yearLabel = year === 1 ? '元' : String(year)
  return `令和${yearLabel}年${d.getMonth() + 1}月${d.getDate()}日`
}

function partnerAgreement(input: ContractInput): string {
  const dateLabel = toReiwa(input.contractDate)
  return `${input.partnerName}（以下「御社」といいます。）は、${SALUD_NAME}（以下「弊社」といいます。）に下記に掲げる条件をもって、お客様を紹介し、弊社はこれに承諾します。

第１条（お客様紹介の定義）
パートナー契約としてのお客様紹介とは御社から弊社へ直接ご紹介いただいた会社様が委託契約に至ったこととします。（御社を通じてご紹介いただくお客様の範囲や基準については、その都度協議のうえ決定します。）

第２条（業務内容および取扱い）
お客様が弊社に対し委託する補助金業務の報酬額は、別紙コミッション表の通りとします。「補助金の窓口」の代理店基本料金を基準として営業していただくことを前提にご案内をお願いいたします。補助金申請に係るお客様とのやり取りは基本的にチャットツールでのやり取りとさせていただきます。Zoomなどのオンラインでの打ち合わせを基本対応可能とします。対面をご希望される場合は実費相当分の出張費を頂戴させていただきます。

第３条（報酬および支払条件）
御社へのパートナー報酬の支払方法は次の通りとします。
1. お客様から着手金がお支払いされた月の末日までに入金の報告をチャットにて致します。御社は報酬合計額の請求書を弊社に発行することによりご請求してくださいますようお願い申し上げます。請求書到達後、お客様の申請完了後の月末までにお支払いします。
2. お客様の補助金が採択された後、交付申請が事務局により承認された段階で、成功報酬の対象とさせていただきます。お客様より成功報酬のお支払いが完了しましたら、その月の末日までに弊社よりチャットにてご報告いたします。御社におかれましては、金額等をご確認のうえ、弊社宛に請求書をご発行いただきますようお願い申し上げます。請求書が弊社に到達した後は、お客様からの成功報酬入金月の翌月末日までにお支払いさせていただきます。なお、成功報酬について、万が一お客様から返金が生じた場合には、御社は弊社に対し、該当額を速やかに返金するものとします。

第４条（業務進捗の報告）
弊社はお客様との手続きの進捗について御社に対し求めがあった場合は、随時報告させていただきます。

第５条（協力事項）
御社よりご紹介いただいたお客様が、万が一以下の事項に該当する場合は、弊社と協力して対応をお願いいたします。
1. お客様との連絡が取れなくなってしまったとき
2. お約束の期限までに情報をいただけないとき
3. 補助金の入金確認や連絡をしていただけないとき
4. 弊社が請求した報酬を期限までにご入金いただけないとき
5. その他弊社とお客様とのトラブルに対するご相談、ご対応
6. 顧客相談シートに記入をお願いいたします。

第6条（秘密保持）
御社および弊社は、本契約の履行に関連して知り得た相手方の営業上または技術上の一切の情報について、第三者に開示または漏洩してはならないものとします。本条の義務は、本契約終了後も有効とします。

第7条（反社会的勢力の排除）
御社および弊社は、自らまたはその役員・従業員・関係者が暴力団、暴力団関係企業、総会屋、その他これに準ずる反社会的勢力に該当しないことを保証し、かつ将来にわたってもこれに該当しないことを確約します。万一、本条に違反する事実が判明した場合には、相手方は何らの催告なくして本契約を解除することができるものとします。

第8条（準拠法および合意管轄）
本契約の成立、効力、解釈および履行に関しては、日本法を準拠法とします。また、本契約に起因または関連して生じる一切の紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。

第9条（契約締結）
本契約の成立を証するため、本書を作成し、電子サインにより締結後、各1通を保管します。


${dateLabel}

御社）${input.partnerAddress}
　　　${input.partnerName}
　　　代表取締役　${input.representativeName}

弊社）${SALUD_ADDRESS}
　　　${SALUD_NAME}
　　　代表取締役　${SALUD_REPRESENTATIVE}`
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    key: 'partner_agreement',
    label: 'パートナー契約合意書（代理店紹介契約）',
    description: '代理店からのお客様紹介・コミッション支払条件を定める契約書',
    title: 'パートナー契約合意書',
    render: partnerAgreement,
  },
]

export function getContractTemplate(key: string): ContractTemplate | undefined {
  return CONTRACT_TEMPLATES.find(t => t.key === key)
}
