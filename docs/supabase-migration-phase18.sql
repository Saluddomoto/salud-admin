-- ================================================================
-- Phase 18 マイグレーション
-- 適用済みの supabase-schema.sql + phase3〜17 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- WEB制作案件の土台: 案件区分・WEB制作用の金額(税抜)・入金予定日/入金日
-- 将来の売上管理ダッシュボード(補助金＋WEB制作を横断した目標/実績管理)の
-- 前段として、まず案件側にWEB制作を表現できるようにする。

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'subsidy'
    CHECK (project_type IN ('subsidy', 'web')),
  ADD COLUMN IF NOT EXISTS web_fee_excl_tax NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS payment_received_date DATE;

-- WEB制作案件には補助金名が無いため NOT NULL を外す
ALTER TABLE public.projects
  ALTER COLUMN subsidy_name DROP NOT NULL;
