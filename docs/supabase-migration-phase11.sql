-- ================================================================
-- Phase 11 マイグレーション — 案件の基本料金・成功報酬（売上管理の元データ）
-- 適用済みの supabase-schema.sql + phase3〜10 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

ALTER TABLE public.projects
  ADD COLUMN base_fee BIGINT,              -- 基本料金（円）: 100000 / 120000 / 150000
  ADD COLUMN success_fee_rate NUMERIC(4,1); -- 成功報酬率（%）: 8.0〜15.0
