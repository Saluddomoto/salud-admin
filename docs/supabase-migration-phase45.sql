-- ================================================================
-- Phase 45 マイグレーション — コラム自動下書き(salud-web.jp)の履歴
-- supabase-migration-phase44.sql 適用後に、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 毎晩の自動生成で作った下書きの記録。同じテーマの重複を防ぐために使う。
CREATE TABLE IF NOT EXISTS public.column_drafts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subsidy     TEXT NOT NULL,            -- 'jizokuka' | 'shinmono' など
  title       TEXT NOT NULL,
  wp_post_id  INTEGER,                  -- WordPress の投稿ID（下書き）
  unsure      JSONB NOT NULL DEFAULT '[]'::jsonb, -- AIが「要確認」とした点
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- サーバー（サービスロール）専用。画面からは参照しない。
ALTER TABLE public.column_drafts ENABLE ROW LEVEL SECURITY;
