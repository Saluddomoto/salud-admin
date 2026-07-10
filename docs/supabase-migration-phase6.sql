-- ================================================================
-- Phase 6 マイグレーション — ダイジェスト配信の個別ON/OFF
-- 適用済みの supabase-schema.sql + phase3〜5 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- line_user_id を登録しても、毎朝のダイジェスト配信は個別にON/OFFできるようにする
-- （LINEでの予定自動登録は line_user_id のみで動作し、この列には依存しない）
ALTER TABLE public.profiles
  ADD COLUMN digest_enabled BOOLEAN NOT NULL DEFAULT TRUE;
