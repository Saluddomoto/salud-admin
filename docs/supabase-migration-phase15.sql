-- ================================================================
-- Phase 15 マイグレーション
-- 適用済みの supabase-schema.sql + phase3〜14 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 1. メンバー別「今年の目標（採択金額）」欄を追加
ALTER TABLE public.profiles
  ADD COLUMN annual_target_amount BIGINT;

-- 栗原さんの今年の目標: 採択金額3,000万円
UPDATE public.profiles
  SET annual_target_amount = 30000000
  WHERE id = 'df64943f-51dc-4a2f-835a-71a550feeab8';

-- 2. projects にも customers と同じ RLS 不具合があったため予防的に修正
--    （staff が案件の担当を自分以外に変更すると保存できない問題）
DROP POLICY "projects: staff update assigned" ON public.projects;

CREATE POLICY "projects: staff update assigned"
  ON public.projects FOR UPDATE
  USING (assigned_user_id = auth.uid() AND public.get_my_role() = 'staff')
  WITH CHECK (public.get_my_role() = 'staff');
