-- ================================================================
-- Phase 7 マイグレーション — 通知設定の永続化
-- 適用済みの supabase-schema.sql + phase3〜6 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN notification_prefs JSONB NOT NULL DEFAULT '{
    "deadline_alert": true,
    "new_inquiry": true,
    "task_reminder": true,
    "result_notice": true,
    "weekly_summary": false
  }'::jsonb;
