-- ================================================================
-- Phase 5 マイグレーション — Google カレンダー連携
-- Supabase Dashboard → SQL Editor で実行してください
-- ================================================================

-- Google OAuth トークン保管（RLS 有効・ポリシーなし = サービスロールのみアクセス可）
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  user_id        UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  refresh_token  TEXT        NOT NULL,
  calendar_id    TEXT,
  calendar_name  TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Google 由来の予定を識別・重複防止するための列
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS google_event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_google_id ON public.events (google_event_id);
