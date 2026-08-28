'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/hooks/useAuth'

/* ─── 更新履歴（新しい順）───────────────────────────── */
// 機能追加・修正のたびにここへ1行追加する運用。日付は実施日(YYYY-MM-DD)。
const CHANGELOG: { date: string; summary: string }[] = [
  { date: '2026-08-28', summary: '役員月報の表示（保存済みの内容を見る画面）を見やすく整理しました。各ブロックをカード分けし、「・」始まりの行は箇条書き、「【見出し】」形式の行は小見出しとして自動的に整形されます。' },
  { date: '2026-08-28', summary: '役員月報「来月の計画」の「⑥ 来月取り組むこと」と「⑦ 来月の成果」を、「⑥ 来月の取り組み・成果」1項目に統合しました。行動と成果を別欄に分けず、「何をして、どうなりたいか」を1つの文章で書けるようにしています。全7項目（今月の活動／営業／年間目標に対する今月の進捗／現在の課題／議論したいこと／来月の取り組み・成果／必要なサポート）に整理しました。' },
  { date: '2026-08-28', summary: '役員月報「目標への進捗」の年間目標（事前シート③）を、その場で「編集」から更新できるようにしました。これまでは事前シート側の編集フォーム（他の3項目も含む）を開く必要がありました。' },
  { date: '2026-08-28', summary: '役員月報の「① 今月の活動」を、これまで別項目だった「行動」と「取り組んだこと」を統合したものに変更しました。過去に「取り組んだこと」欄へ書かれていた内容（栗原さん7月分・堂本さん8月分など）も消えず、「今月の活動」の中にまとめて表示されます。' },
  { date: '2026-08-28', summary: '役員月報の各項目に、Saludの実業務を想定した記入例（コピー用ではなく書き方の参考）を追加しました。質問・補足説明より薄く目立たないデザインで、入力欄の下に表示しています。あわせて質問文・番号を実際の運用に合わせて整理しました。' },
  { date: '2026-08-28', summary: '役員月報を「今月の振り返り／目標への進捗／月末会議／来月の計画」の4ブロック構成に拡張しました。「目標への進捗」には役員会議 事前シートの③（今年、自分がSaludにもたらしたいこと）をその年の目標として自動表示し、そのうえで進捗・課題・議論したいこと・来月の成果を整理できます。既存の行動・営業・タスク・取り組んだことの内容はそのまま保持されます。年間目標の表示は、その月の月報をまだ書いていない役員でも（事前シートさえ書いていれば）見えるようにしています（当初、月報未記入の栗原さんの目標が一緒に隠れてしまう不具合があったため修正）。' },
  { date: '2026-08-19', summary: '代理店管理に、総登録件数・年間登録件数と、目標（年150社を契約開始月〈2026年7月〉起点に月2件ペースで按分した数値）に対する進捗バーを追加しました。' },
  { date: '2026-08-19', summary: '契約書作成時に、顧客登録情報（会社名・住所・代表者）を自動入力できるようにしました。あわせて顧客追加フォームに住所欄を追加しています。' },
  { date: '2026-08-19', summary: '契約書を作成した後でも入力内容を編集できるようにしました（これまでは作成後の修正ができませんでした）。あわせて区切り線の表示幅を修正しました。' },
  { date: '2026-08-18', summary: '朝のLINEダイジェストで、神前さんには堂本さんの予定を共有しないようにしました。' },
  { date: '2026-08-18', summary: '売上予測の内訳で、案件由来の行（実績・パイプライン見込み）から案件詳細へ遷移できるようにしました（手入力の台帳行・月額契約の見込み行は対象外）。' },
  { date: '2026-08-18', summary: '売上予測の内訳モーダルに、確定/見込みで絞り込めるタブを追加しました。' },
  { date: '2026-08-18', summary: 'サイドバーの固定バッジ「3」を実データに連動させました。受信トレイは実際の要返信件数を表示し、補助金管理は集計ロジックがないためバッジを削除しました（これまでは0件でも常に「3」と表示されていました）。' },
  { date: '2026-08-18', summary: '役員月報ページで「役員会議 事前シート」を月報より上に配置し、タスク管理でその月に完了したタスクが月報に自動で反映されるようにしました。' },
  { date: '2026-08-17', summary: 'Chatwork連携を追加しました。顧客詳細でChatworkルームIDを登録しておくと、そのルームでのクライアントの発言が受信トレイに自動で取り込まれ、未返信のままなら公式LINEでリマインドされます（設定＞メンバー管理で各自のChatworkアカウントIDを登録すると、自分の発言は「対応済み」として扱われます）。' },
  { date: '2026-08-17', summary: '顧客の削除を、権限に関わらず誰でもできるようにしました（これまでは管理者・マネージャーのみで、一般権限の方が押すと「権限がない」エラーになっていました）。案件の削除は従来どおり管理者・マネージャーのみです。' },
  { date: '2026-08-17', summary: '未返信メッセージのLINEリマインドを、土日は送信しないようにしました（平日9〜19時のみ）。' },
  { date: '2026-08-17', summary: '案件管理のステータスに「失注」を追加しました。補助金の「不採択」（審査で通らなかった）とは別に、商談段階で見送り・失注になった案件を区別して管理できます。' },
  { date: '2026-08-15', summary: '「代理店管理」ページを追加しました。代理店募集フォームの回答を自動で取り込み、既存の代理店リストと合わせて一覧・検索・編集できます（「フォームと今すぐ同期」ボタンで最新の回答をいつでも反映できます）。' },
  { date: '2026-08-13', summary: 'LINEグループ内の発言をAIが自動チェックし、タスクになりそうな内容を検出したらタスク管理に「候補（要確認）」として自動で追加するようにしました。内容を確認して「承認してタスク化」を押すと正式なタスクになります（不要なものは却下できます）。' },
  { date: '2026-08-13', summary: 'LINEグループ（公式アカウントを追加したグループ）にも対応しました。クライアントを含むグループでスタッフが発言しても、以前のように「予定として登録できませんでした」と誤って返信しないよう修正しました。' },
  { date: '2026-08-13', summary: '受信から2時間経っても未返信のメッセージがあれば、営業時間内（9時〜19時）に1時間おきチェックし、LINEでリマインド通知するようにしました。1:1のメッセージ・LINEグループのメッセージどちらも対象です。' },
  { date: '2026-08-13', summary: 'タスク管理で、カードをクリックして内容（タスク名・メモ・担当者・優先度・期限・関連案件）を編集できるようにしました。これまでは新規追加のみで、既存タスクの編集はできませんでした。' },
  { date: '2026-08-13', summary: '役員月報ページを、タブ切替式から「月報」「役員会議 事前シート」を縦に並べて常時表示する形に変更しました。開かなくても他の役員の内容が目に入ります。' },
  { date: '2026-08-13', summary: '役員月報ページに「役員会議 事前シート」を追加しました。役員が互いに閲覧・編集できます（堂本さん・和家さん・栗原さんの既存内容を反映済み）。' },
  { date: '2026-08-13', summary: '役員月報の「タスク」欄に、タスク管理でその月に完了したタスクを箇条書きで読み込むボタンを追加しました。' },
  { date: '2026-08-13', summary: 'マニュアルに「更新履歴」を追加しました。今後の機能追加・修正はここに記録していきます。' },
  { date: '2026-08-12', summary: 'ダッシュボードの「売上管理」カードの金額が売上管理ページ（売上台帳）と一致しない不具合を修正しました。' },
  { date: '2026-08-12', summary: '補助金の採択率（実績）を売上予測の計算にも反映するようにしました。不採択の記録が増えるほど、見込み売上が実態に近づきます。' },
  { date: '2026-08-11', summary: '売上目標の設定画面を追加しました（会社全体の目標、カテゴリ別の目標件数・単価を編集できます）。' },
  { date: '2026-08-11', summary: '一般メンバーも全顧客・全案件を閲覧できるようにしました（これまでは自分の担当分のみでした）。' },
  { date: '2026-08-10', summary: '売上管理ページを新設しました（売上台帳・月次実績・売上予測・月額契約）。' },
  { date: '2026-08-10', summary: 'WEB制作の案件も売上管理に反映されるようにしました。' },
]

/* ─── 権限（ロール）の概要 ─────────────────────────── */
const ROLES = [
  {
    key: 'admin',
    label: '管理者',
    cls: 'bg-brand-100 text-brand-700',
    ring: 'ring-brand-200',
    who: '経営・システム管理者',
    summary: 'すべての機能を利用でき、メンバーの追加・停止・権限変更ができます。',
  },
  {
    key: 'manager',
    label: 'マネージャー',
    cls: 'bg-indigo-100 text-indigo-700',
    ring: 'ring-indigo-200',
    who: '営業リーダー・管理職',
    summary: '全メンバーの顧客・案件・タスク・実績を見て、割り当てや削除ができます。',
  },
  {
    key: 'staff',
    label: '一般',
    cls: 'bg-slate-100 text-slate-600',
    ring: 'ring-slate-200',
    who: '各担当者',
    summary: '自分の担当している顧客・案件・タスクを中心に利用できます。',
  },
] as const

/* ─── 権限マトリクス ───────────────────────────────── */
type Cell = { s: '○' | '△' | '×'; note?: string }
const MATRIX: { feature: string; admin: Cell; manager: Cell; staff: Cell }[] = [
  { feature: '顧客・案件を見る',
    admin: { s: '○', note: '全件' }, manager: { s: '○', note: '全件' }, staff: { s: '△', note: '自分の担当のみ' } },
  { feature: '顧客・案件を追加する',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '○' } },
  { feature: '顧客を削除する',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '○' } },
  { feature: '案件を削除する',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '×' } },
  { feature: 'タスクを見る',
    admin: { s: '○', note: '全員分' }, manager: { s: '○', note: '全員分' }, staff: { s: '△', note: '自分＋共有分' } },
  { feature: 'タスクを他の人に割り当て・LINE通知',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '×' } },
  { feature: '受信トレイの対応（既読・返信済み）',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '○' } },
  { feature: '受信トレイのメッセージを消す',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '×' } },
  { feature: '予定を追加する',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '○' } },
  { feature: '他の人の予定を編集・削除',
    admin: { s: '○' }, manager: { s: '○' }, staff: { s: '△', note: '自分の予定のみ' } },
  { feature: '実績・売上目標を見る',
    admin: { s: '○', note: '全体' }, manager: { s: '○', note: '全体' }, staff: { s: '△', note: '自分中心' } },
  { feature: 'メンバーの招待・停止・権限変更',
    admin: { s: '○' }, manager: { s: '×' }, staff: { s: '×' } },
  { feature: 'LINE朝配信のON/OFF切替',
    admin: { s: '○' }, manager: { s: '×' }, staff: { s: '×' } },
  { feature: '設定ページ（プロフィール・通知・連携）',
    admin: { s: '○' }, manager: { s: '×' }, staff: { s: '×' } },
]

const CELL_CLS: Record<Cell['s'], string> = {
  '○': 'text-emerald-600',
  '△': 'text-amber-600',
  '×': 'text-slate-300',
}

/* ─── 各機能の使い方 ───────────────────────────────── */
const GUIDES: { title: string; badge?: string; steps: string[] }[] = [
  {
    title: 'ダッシュボード',
    steps: [
      'ログインすると最初に開く画面です。案件・タスク・問い合わせなど全体の状況をひと目で確認できます。',
      '左のメニューから各機能へ移動します。',
    ],
  },
  {
    title: '顧客管理',
    steps: [
      '取引先の会社を一覧・検索できます。会社名や担当者名で絞り込み、業種・ステータスでも絞れます。',
      '「＋顧客を追加」で新規登録（会社名・担当者・電話・業種・従業員数・ステータス）。',
      '行をクリックすると詳細ページが開き、社内担当・関連資料（Drive）を確認できます。',
      '※ 一般権限では自分が担当する顧客のみ表示されます。',
      '※ 顧客の削除は、紐づく案件もすべて削除されます（取り消せません）。この操作は権限に関わらず誰でも行えます。',
      '編集画面で「Chatwork ルームID」を登録すると、そのルームでのクライアントの発言が受信トレイに自動で取り込まれます（管理者に設定を依頼してください）。',
    ],
  },
  {
    title: '案件管理',
    steps: [
      '補助金の申請案件を管理します。ステータスは 見込み → 申請準備中 → 申請済み → 採択／不採択 → 完了 と進みます。顧客未登録でも案件を作成でき、あとから顧客・社内担当（最大2名）を紐付けられます。',
      '「不採択」は補助金の審査で通らなかった場合、「失注」は審査結果を待たずに商談段階で見送り・お断りになった場合に使い分けてください。カード右下のステータス欄から選択できます。',
      '各案件に「申請額・採択額・着手金・成功報酬率」を入力しておくと、実績や売上の集計に反映されます。',
      '「＋案件を追加」で登録。行クリックで詳細（担当・資料・メモ）。',
      '※ 削除は管理者・マネージャーのみ可能です。',
    ],
  },
  {
    title: '補助金管理',
    steps: [
      '取り扱う補助金の情報を一覧で確認できます。',
      '案件を作るときの参照用としてご利用ください。',
    ],
  },
  {
    title: 'タスク管理',
    steps: [
      '「未着手／進行中／完了」の3列（カンバン）でタスクを管理します。',
      '「＋タスクを追加」でタスク名・内容メモ・優先度・期限・関連案件を登録できます。',
      '各カードの ← → ボタンで列を移動、完了したカードは × で削除できます。',
      '管理者・マネージャーは、担当者を選んで他の人に割り当て、その場で本人にLINE通知を送れます。',
      '上部の担当者フィルタで、特定メンバーのタスクだけを表示できます。',
      'LINEグループでの発言からAIがタスクになりそうな内容を検出すると、カンバンの上に「タスク候補（要確認）」として表示されます。「内容を確認して承認」で正式なタスクになり（担当者は自分になっている場合は変更可）、不要なら「却下」で消せます。',
    ],
  },
  {
    title: '受信トレイ',
    steps: [
      'LINE・Chatwork・メール・Webフォームからの問い合わせが1か所に集まります。',
      'クリックで既読になります。「要返信」バッジのものは、対応後に「返信済みにする」を押します。',
      '不要なメッセージは「消す」で削除できます。削除はPC・スマホどちらで行っても両方に反映されます。',
      'スマホでは、メッセージを左にスワイプすると消せます。',
      '※ メッセージの削除は管理者・マネージャーのみ可能です。',
      '公式LINE「補助金の窓口」をクライアント混在のグループに追加している場合、グループ内でのやり取りも受信トレイに入ります。スタッフ以外の発言は「要返信」で記録され、スタッフがグループ内で一度でも発言すると、そのグループの未返信はまとめて解消扱いになります。',
      '受信から2時間経っても未返信のメッセージがあると、営業時間内（9時〜19時、1時間おきチェック）に登録メンバー全員へLINEでリマインドが届きます（1メッセージにつき1回）。',
      '※ スタッフ本人の個人LINEから公式アカウントへ1:1で送ったメッセージは、受信トレイではなく「予定登録コマンド」として処理されます（スケジュールの項を参照）。受信トレイに入るのはクライアント等スタッフ以外からのメッセージです。',
    ],
  },
  {
    title: 'スケジュール',
    steps: [
      'チームの予定をカレンダーで確認できます。Googleカレンダーと連携して同期できます（設定 → 連携サービス）。',
      '「商談」の予定を登録すると、実績ページの商談件数に自動でカウントされます。',
      '※ 他の人の予定の編集・削除は管理者・マネージャーのみ。自分の予定は本人が編集できます。',
    ],
  },
  {
    title: '実績・売上目標',
    badge: '一部準備中',
    steps: [
      '月ごとに、メンバー別の「商談 → 受注 → 採択金額」を集計して表示します。上部の ‹ › で月を切り替えます。',
      '会社全体の収支目標や、メンバー別の補助金獲得目標を確認できるよう拡張予定です。',
      '目標金額は管理者が入力し、実績・見込みは案件データから自動集計されます。',
    ],
  },
  {
    title: '設定（管理者のみ）',
    badge: '管理者限定',
    steps: [
      'プロフィール：氏名・部署の変更。',
      'メンバー管理：メンバーの招待（仮パスワード発行）、停止／復帰、権限変更、朝のLINE配信ON/OFF。',
      '通知設定：期限アラートや週次サマリーなどの受け取り設定。',
      'セキュリティ：自分のパスワード変更。',
      '連携サービス：Googleカレンダー連携の接続／解除。',
    ],
  },
  {
    title: '社内フォルダ',
    steps: [
      'メニューの「社内フォルダ」から、会社共有のGoogle Drive（社内ノウハウ・資料）を新しいタブで開きます。',
    ],
  },
]

export default function ManualPage() {
  const { role } = useAuth()
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader title="マニュアル" description="各機能の使い方と、権限（管理者・マネージャー・一般）の違い" />

      {/* ログイン・基本 */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-slate-800">はじめに（ログイン）</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>・ ログインURL：<span className="font-medium text-brand-700">https://salud-admin-azure.vercel.app</span></li>
          <li>・ ID は<b>メールアドレス</b>、パスワードは管理者から配布された仮パスワードです（大文字・小文字は区別されます）。</li>
          <li>・ スマホでも同じURL・同じIDで入れます。ログイン状態は保持されます。</li>
          <li>・ パスワードを忘れたら、ログイン画面の「パスワードをお忘れの方はこちら」から再設定できます。</li>
        </ul>
      </section>

      {/* 更新履歴 */}
      <section className="card p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800">更新履歴</h2>
          <span className="badge bg-emerald-100 text-xs text-emerald-700">随時更新</span>
        </div>
        <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
          {CHANGELOG.map((c, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex-shrink-0 font-mono text-xs text-slate-400">{c.date}</span>
              <span>{c.summary}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* システムの保存先・PC故障時の復旧手順 */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-slate-800">システムの保存先・PC故障時の復旧手順</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            本システムは <span className="font-medium">Vercel</span>（アプリ本体）と{' '}
            <span className="font-medium">Supabase</span>（データベース）というクラウド上で稼働しています。
            社内の特定のパソコンには依存していないため、開発担当者のPCが故障・紛失しても、
            このシステムの稼働やデータには影響ありません（メンバーは今まで通りログイン・利用できます）。
          </p>
          <p>
            プログラム本体（ソースコード）は <span className="font-medium">GitHub</span>{' '}
            にもバックアップされています：
            <br />
            <code className="text-xs">https://github.com/Saluddomoto/salud-admin</code>
          </p>
          <p className="font-medium text-slate-700">開発用PCが故障し、別のPCで開発を再開する場合の手順：</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li><code className="text-xs">git clone https://github.com/Saluddomoto/salud-admin.git</code></li>
            <li>Supabaseダッシュボード（プロジェクト設定 → API）からURL・鍵を取得し、各アプリの <code className="text-xs">.env.local</code> を作り直す</li>
            <li>リポジトリ直下で <code className="text-xs">pnpm install</code>（pnpmモノレポのため、npm/yarnは使わない）</li>
            <li><code className="text-xs">pnpm build --filter=@salud/admin</code> または各アプリで <code className="text-xs">pnpm dev</code> により開発再開</li>
            <li>Vercelへのデプロイを再び行いたい場合は <code className="text-xs">npx vercel link</code> でこのプロジェクトに再接続</li>
          </ol>
          <p className="text-xs text-slate-400">
            ※ 本番環境（実際に使う画面）自体はVercel上で稼働し続けるため、上記はあくまで「今後の開発・修正作業を再開するための手順」です。
          </p>
        </div>
      </section>

      {/* 権限の違い */}
      <section className="flex flex-col gap-4">
        <h2 className="px-1 text-sm font-bold text-slate-800">権限（ロール）の違い</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ROLES.map(r => (
            <div
              key={r.key}
              className={`card p-4 ${role === r.key ? `ring-2 ${r.ring}` : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`badge text-xs ${r.cls}`}>{r.label}</span>
                {role === r.key && <span className="text-xs font-medium text-brand-600">あなた</span>}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">{r.who}</p>
              <p className="mt-1 text-sm text-slate-600">{r.summary}</p>
            </div>
          ))}
        </div>

        {/* マトリクス */}
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-3 text-left font-medium">できること</th>
                <th className="px-3 py-3 text-center font-medium">管理者</th>
                <th className="px-3 py-3 text-center font-medium">マネージャー</th>
                <th className="px-3 py-3 text-center font-medium">一般</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(row => (
                <tr key={row.feature} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{row.feature}</td>
                  {([row.admin, row.manager, row.staff]).map((c, i) => (
                    <td key={i} className="px-3 py-2.5 text-center">
                      <span className={`text-base font-bold ${CELL_CLS[c.s]}`}>{c.s}</span>
                      {c.note && <span className="mt-0.5 block text-[10px] leading-tight text-slate-400">{c.note}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-1 text-xs text-slate-400">
          <span className="font-bold text-emerald-600">○</span> 利用可 ／
          <span className="font-bold text-amber-600"> △</span> 自分の担当・自分の分のみ ／
          <span className="font-bold text-slate-400"> ×</span> 利用不可
        </p>
      </section>

      {/* 各機能の使い方 */}
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-bold text-slate-800">各機能の使い方</h2>
        {GUIDES.map((g, i) => {
          const isOpen = open === i
          return (
            <div key={g.title} className="card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-semibold text-slate-800">{g.title}</span>
                {g.badge && (
                  <span className="badge bg-amber-100 text-xs text-amber-700">{g.badge}</span>
                )}
                <svg
                  className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <ul className="space-y-2 border-t border-slate-50 px-4 py-3.5 pl-5 text-sm leading-relaxed text-slate-600">
                  {g.steps.map((s, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </section>

      <p className="text-xs text-slate-400">
        ※ 操作で困ったことや「こうしたい」があれば、管理者までお知らせください。マニュアルは随時更新します。
      </p>
    </div>
  )
}
