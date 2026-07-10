-- ================================================================
-- Phase 9 マイグレーション — 管理者によるタスク依頼（他人への割当）+ 通知
-- 適用済みの supabase-schema.sql + phase3〜8 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 1. staff が team-shared な同僚のタスクを見るとき、embedded join で
--    profiles.full_name を解決できるよう、profiles 側にも読み取りを許可する
CREATE POLICY "profiles: staff read team-shared"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() = 'staff'
    AND tasks_shared_with_team = TRUE
  );

-- 2. tasks の INSERT ポリシーを差し替え。
--    staff は自分宛のタスクのみ作成可能、admin/manager は誰宛にも作成可能
--    （＝管理者が他メンバーへタスクを「依頼」できるようにする）
DROP POLICY "tasks: staff+ insert" ON public.tasks;

CREATE POLICY "tasks: insert own or admin/manager assign"
  ON public.tasks FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('admin', 'manager')
    OR (public.get_my_role() = 'staff' AND assigned_user_id = auth.uid())
  );
