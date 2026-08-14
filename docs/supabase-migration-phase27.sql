-- ================================================================
-- Phase 27 マイグレーション — タスク候補(下書き)をスタッフ全員に開放
-- 既存の "tasks: staff read own" 等は assigned_user_id/created_by が
-- 自分のものしか見えない設計のため、下書き(assigned_user_id/created_by
-- ともにNULL)はstaffから見えず、実質admin/managerしか承認・却下できなかった。
-- 下書き(source='ai_line' AND reviewed_at IS NULL)に限り、ロール問わず
-- 全員が閲覧・承認(UPDATE)・却下(DELETE)できるポリシーを追加する。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

CREATE POLICY "tasks: anyone read drafts"
  ON public.tasks FOR SELECT
  USING (source = 'ai_line' AND reviewed_at IS NULL);

CREATE POLICY "tasks: anyone update drafts"
  ON public.tasks FOR UPDATE
  USING (source = 'ai_line' AND reviewed_at IS NULL)
  WITH CHECK (source = 'ai_line');

CREATE POLICY "tasks: anyone delete drafts"
  ON public.tasks FOR DELETE
  USING (source = 'ai_line' AND reviewed_at IS NULL);
