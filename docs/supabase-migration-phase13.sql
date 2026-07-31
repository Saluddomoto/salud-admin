-- ================================================================
-- Phase 13 マイグレーション — 役員月報から「タスク」「稼働実績」を削除
-- 適用済みの supabase-schema.sql + phase3〜12 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

ALTER TABLE public.monthly_reports
  DROP COLUMN tasks,
  DROP COLUMN work_performance;
