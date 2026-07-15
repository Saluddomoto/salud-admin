import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyZoomSignature, zoomUrlValidation, fetchTranscriptText } from '@/lib/zoom'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RecordingFile = { file_type?: string; file_extension?: string; download_url?: string }
type ZoomObject = {
  uuid?: string
  id?: number | string
  topic?: string
  start_time?: string
  duration?: number
  host_email?: string
  share_url?: string
  recording_files?: RecordingFile[]
}
type ZoomEvent = {
  event?: string
  download_token?: string
  payload?: { plainToken?: string; object?: ZoomObject }
}

// Zoom Cloud Recording の Webhook 受信。
// - endpoint.url_validation : Zoom の URL 検証チャレンジに応答
// - recording.completed     : 会議の録画メタ情報を meeting_notes に登録
// - recording.transcript_completed : 文字起こし(.vtt)を取り込んで transcript に格納
// Zoom Marketplace の Event Subscription で Webhook URL に https://<host>/api/zoom/webhook を設定する。
export async function POST(req: Request) {
  const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN
  if (!secretToken) {
    return NextResponse.json({ error: 'Zoom 環境変数が未設定です' }, { status: 503 })
  }

  const rawBody = await req.text()
  const body = JSON.parse(rawBody) as ZoomEvent

  // 1) URL 検証チャレンジ（署名不要・最優先で応答）
  if (body.event === 'endpoint.url_validation' && body.payload?.plainToken) {
    return NextResponse.json(zoomUrlValidation(body.payload.plainToken, secretToken))
  }

  // 2) 署名検証
  const ok = verifyZoomSignature(
    rawBody,
    req.headers.get('x-zm-signature'),
    req.headers.get('x-zm-request-timestamp'),
    secretToken,
  )
  if (!ok) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })

  const obj = body.payload?.object
  if (!obj?.uuid) return NextResponse.json({ ok: true })

  const admin = createAdminClient()

  const base = {
    zoom_uuid:       obj.uuid,
    zoom_meeting_id: obj.id != null ? String(obj.id) : null,
    title:           obj.topic || '(無題の会議)',
    meeting_date:    obj.start_time ?? null,
    duration_min:    obj.duration ?? null,
    host_name:       obj.host_email ?? null,
    recording_url:   obj.share_url ?? null,
    source:          'zoom',
    updated_at:      new Date().toISOString(),
  }

  // 3) 文字起こし(.vtt)があれば取り込む
  //    transcript_completed だけでなく recording.completed でも、TRANSCRIPT ファイルが
  //    含まれていれば拾う（イベント購読が「録画完了」だけでも文字起こしを取得できるように）
  let transcript: string | null = null
  if (body.event === 'recording.transcript_completed' || body.event === 'recording.completed') {
    transcript = await fetchTranscriptText(obj.recording_files ?? [], body.download_token ?? null)
  }

  const row = transcript != null ? { ...base, transcript } : base

  const { error } = await admin
    .from('meeting_notes')
    .upsert(row, { onConflict: 'zoom_uuid' })
  if (error) console.error('Zoom webhook: upsert failed', error)

  return NextResponse.json({ ok: true })
}
