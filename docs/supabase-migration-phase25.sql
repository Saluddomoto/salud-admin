-- ================================================================
-- Phase 25 マイグレーション — LINEグループ対応 + 未返信リマインド
-- 背景: 公式LINE「補助金の窓口」をクライアント混在のグループに追加する運用が
-- 始まったが、既存コードは1:1トーク前提のため、グループ内でスタッフが
-- 何か発言すると「予定登録コマンド」と誤認識し、グループ全体に
-- 「予定として登録できませんでした」と誤返信していた（2026-08-13 発覚）。
-- このマイグレーションで①グループ管理テーブルを新設②messagesにグループ
-- 発信元の情報とリマインド送信済みフラグを追加する。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

CREATE TABLE public.line_groups (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  line_group_id TEXT        NOT NULL UNIQUE,
  group_name    TEXT,
  customer_id   UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
  project_id    UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.line_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "line_groups: staff+ read"
  ON public.line_groups FOR SELECT
  USING (public.get_my_role() IS NOT NULL);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'user'
    CHECK (source_type IN ('user', 'group', 'room')),
  ADD COLUMN IF NOT EXISTS line_group_id TEXT REFERENCES public.line_groups(line_group_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
