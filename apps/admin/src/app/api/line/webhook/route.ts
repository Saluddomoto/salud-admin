import { NextResponse } from 'next/server'
import {
  getLineGroupMemberProfile,
  getLineGroupSummary,
  getLineProfile,
  lineReply,
  verifyLineSignature,
  type LineWebhookBody,
} from '@salud/line'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseEventMessage } from '@/lib/line-event-parser'
import { classifyLineMessageForTask } from '@salud/ai'

type AdminClient = ReturnType<typeof createAdminClient>

// グループ/複数人トークを初回検知時に line_groups へ登録する（既存なら何もしない）
async function ensureLineGroup(admin: AdminClient, groupId: string, accessToken: string) {
  const { data: existing } = await admin
    .from('line_groups')
    .select('id')
    .eq('line_group_id', groupId)
    .maybeSingle()
  if (existing) return

  const summary = await getLineGroupSummary(groupId, accessToken)
  const { error } = await admin.from('line_groups').insert({
    line_group_id: groupId,
    group_name: summary?.groupName ?? null,
  })
  if (error) console.error('LINE webhook: line_groups insert failed', error)
}

// グループ内の発言をAI(Haiku)で判定し、タスク候補なら下書きとしてtasksに挿入する
// （承認待ち = source='ai_line' AND reviewed_at IS NULL、タスク管理画面でレビューする）
async function maybeCreateTaskDraft(
  admin: AdminClient,
  params: { groupName: string | null; senderName: string; text: string; sourceMessageId: string | null },
) {
  try {
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const candidate = await classifyLineMessageForTask(params.text, {
      senderName: params.senderName,
      groupName: params.groupName,
      today,
    })
    if (!candidate.isTask || !candidate.title) return

    const { error } = await admin.from('tasks').insert({
      title:              candidate.title,
      description:        `LINEグループ「${params.groupName ?? '不明'}」の発言（${params.senderName}）: 「${params.text}」`,
      status:              'todo',
      priority:            'medium',
      due_date:            candidate.dueDate,
      project_id:          null,
      assigned_user_id:    null,
      source:              'ai_line',
      source_message_id:   params.sourceMessageId,
    })
    if (error) console.error('LINE webhook: task draft insert failed', error)
  } catch (e) {
    console.error('LINE webhook: task classification failed', e)
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const USAGE_REPLY = [
  '予定として登録できませんでした🙏',
  '日付と時刻を入れて送ってください。例:',
  '',
  '予定 7/10 14:00 山田製作所 打ち合わせ',
  '予定 7/10 14:00-15:30 テックス商談',
].join('\n')

// LINE 公式アカウントへのメッセージを処理する。
// - 社内メンバー（profiles.line_user_id 登録者）から → 予定として解析しスケジュールに登録
// - それ以外（顧客・未登録） → 受信トレイ（messages）に「要返信」で取り込む
// LINE Developers コンソールで Webhook URL に https://<host>/api/line/webhook を設定する。
export async function POST(req: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  const accessToken   = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!channelSecret || !accessToken) {
    return NextResponse.json({ error: 'LINE 環境変数が未設定です' }, { status: 503 })
  }

  const rawBody = await req.text()
  if (!verifyLineSignature(rawBody, req.headers.get('x-line-signature'), channelSecret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as LineWebhookBody
  const admin = createAdminClient()

  for (const event of body.events ?? []) {
    if (event.type !== 'message' || !event.message) continue

    const text = event.message.type === 'text'
      ? (event.message.text ?? '')
      : `（${event.message.type} メッセージを受信しました。LINE アプリで確認してください）`

    const userId     = event.source?.userId ?? null
    const sourceType = event.source?.type ?? 'user'
    const isGroup    = sourceType === 'group' || sourceType === 'room'
    const groupId    = sourceType === 'group' ? event.source?.groupId ?? null
                      : sourceType === 'room'  ? event.source?.roomId ?? null
                      : null
    let senderName = 'LINE ユーザー'
    let companyName: string | null = null

    // 社内メンバーが「個人トーク」で送った場合のみ、予定登録コマンドとして処理する
    // （グループ/複数人トークで同じ扱いをすると、クライアントの目の前で
    //   「予定として登録できませんでした」と誤返信してしまうため対象外にする）
    if (!isGroup && userId) {
      const { data: staff } = await admin
        .from('profiles')
        .select('id, full_name')
        .eq('line_user_id', userId)
        .maybeSingle()

      if (staff) {
        let reply = USAGE_REPLY
        const parsed = event.message.type === 'text' ? parseEventMessage(text) : null
        if (parsed) {
          const { error } = await admin.from('events').insert({
            ...parsed,
            assigned_user_id: staff.id,
            created_by:       staff.id,
            notes:            'LINE から登録',
          })
          reply = error
            ? '登録に失敗しました。時間をおいて再度お試しください🙏'
            : [
                '予定を登録しました✅',
                `📅 ${parsed.event_date.slice(5).replace('-', '/')} ${parsed.start_time}–${parsed.end_time}`,
                `📝 ${parsed.title}（担当: ${staff.full_name}）`,
                '明朝のダイジェストで全員に共有されます。',
              ].join('\n')
          if (error) console.error('LINE webhook: event insert failed', error)
        }
        if (event.replyToken) {
          await lineReply(event.replyToken, [{ type: 'text', text: reply }], accessToken)
            .catch(e => console.error('LINE webhook: reply failed', e))
        }
        continue
      }
    }

    let groupName: string | null = null
    if (isGroup && groupId) {
      if (sourceType === 'group') await ensureLineGroup(admin, groupId, accessToken)

      const { data: group } = await admin
        .from('line_groups')
        .select('group_name')
        .eq('line_group_id', groupId)
        .maybeSingle()
      groupName = group?.group_name ?? null

      if (userId) {
        const { data: staff } = await admin
          .from('profiles')
          .select('id, full_name')
          .eq('line_user_id', userId)
          .maybeSingle()

        if (staff) {
          // 社内メンバーがグループ内で発言した = そのグループの未返信は対応済みとみなす
          // （個々のメッセージ単位で「誰への返信か」までは判定しない、ざっくりした解消判定）
          const { error } = await admin.from('messages')
            .update({ needs_reply: false })
            .eq('line_group_id', groupId)
            .eq('needs_reply', true)
          if (error) console.error('LINE webhook: group reply-clear failed', error)

          if (event.message.type === 'text') {
            await maybeCreateTaskDraft(admin, {
              groupName, senderName: staff.full_name, text, sourceMessageId: null,
            })
          }
          continue
        }
      }
    }

    if (userId) {
      // 顧客マスタに line_user_id が登録されていれば社名・担当者名を紐づける
      const { data: customer } = await admin
        .from('customers')
        .select('company_name, customer_contacts(name, is_primary)')
        .eq('line_user_id', userId)
        .maybeSingle()

      if (customer) {
        companyName = customer.company_name
        const contacts = customer.customer_contacts as { name: string; is_primary: boolean }[] | null
        senderName = contacts?.find(c => c.is_primary)?.name ?? senderName
      }

      if (senderName === 'LINE ユーザー') {
        const profile = sourceType === 'group'
          ? await getLineGroupMemberProfile(groupId!, userId, accessToken)
          : await getLineProfile(userId, accessToken)
        if (profile) senderName = profile.displayName
      }
    }

    if (isGroup && groupId && !companyName) companyName = groupName

    const { data: inserted, error } = await admin.from('messages').insert({
      channel:       'line',
      sender_name:   senderName,
      company_name:  companyName,
      body:          text,
      line_user_id:  userId,
      source_type:   sourceType,
      line_group_id: groupId,
      needs_reply:   true,
      received_at:   event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
    }).select('id').single()
    if (error) console.error('LINE webhook: insert failed', error)

    if (isGroup && groupId && event.message.type === 'text') {
      await maybeCreateTaskDraft(admin, {
        groupName, senderName, text, sourceMessageId: inserted?.id ?? null,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
