import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { analyzeMeetingMinutes } from '@salud/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 議事録(meeting_notes)の transcript/summary を Claude で分析し、
// 要約・決定事項・アクションアイテムを返す。DB へは書き込まない
// (フロント側で内容を確認してから保存ボタンで確定させる)。
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY が設定されていません' },
      { status: 503 },
    )
  }

  const { noteId } = (await req.json()) as { noteId?: string }
  if (!noteId) {
    return NextResponse.json({ error: 'noteId が必要です' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: note, error } = await admin
    .from('meeting_notes')
    .select('transcript, summary')
    .eq('id', noteId)
    .single()
  if (error || !note) {
    return NextResponse.json({ error: '議事録が見つかりません' }, { status: 404 })
  }

  const sourceText = note.transcript || note.summary
  if (!sourceText) {
    return NextResponse.json(
      { error: '分析対象のテキスト(文字起こしまたはメモ)がありません' },
      { status: 400 },
    )
  }

  try {
    const analysis = await analyzeMeetingMinutes(sourceText)
    return NextResponse.json(analysis)
  } catch (e) {
    console.error('AI分析に失敗', e)
    return NextResponse.json({ error: 'AI分析に失敗しました' }, { status: 500 })
  }
}
