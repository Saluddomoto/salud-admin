-- ================================================================
-- Phase 17 マイグレーション
-- 適用済みの supabase-schema.sql + phase3〜16 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- Google Meet 議事録(Gemini メモ)の自動取り込み用
-- 1. meeting_notes: Drive ファイルIDで重複取り込みを防止
ALTER TABLE public.meeting_notes
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_notes_drive_file_id
  ON public.meeting_notes (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

-- 2. google_calendar_connections: 各メンバーの「Meet Recordings」フォルダIDと
--    最終同期時刻をキャッシュ(カレンダー同期の last_synced_at と同じ役割)
ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS drive_meet_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_last_synced_at TIMESTAMPTZ;
