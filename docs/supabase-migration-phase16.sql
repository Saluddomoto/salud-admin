-- ================================================================
-- Phase 16 マイグレーション
-- 適用済みの supabase-schema.sql + phase3〜15 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 1. tasks にも customers/projects と同じ RLS 不具合があったため修正
--    （staff がタスクの担当を自分以外に再割当すると保存できない問題）
DROP POLICY "tasks: staff update assigned" ON public.tasks;

CREATE POLICY "tasks: staff update assigned"
  ON public.tasks FOR UPDATE
  USING (assigned_user_id = auth.uid() AND public.get_my_role() = 'staff')
  WITH CHECK (public.get_my_role() = 'staff');
