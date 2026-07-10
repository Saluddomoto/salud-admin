-- ================================================================
-- Phase 8 マイグレーション — タスクのチーム共有設定（管理者のみ変更可）
-- 適用済みの supabase-schema.sql + phase3〜7 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 管理者/マネージャーは常に全タスクを閲覧できる（既存ポリシーのまま）。
-- staff は自分のタスクのみ閲覧可能だが、本人の tasks_shared_with_team が
-- true の場合に限り、他の staff からも閲覧できるようにする。
ALTER TABLE public.profiles
  ADD COLUMN tasks_shared_with_team BOOLEAN NOT NULL DEFAULT FALSE;

CREATE POLICY "tasks: staff read team-shared"
  ON public.tasks FOR SELECT
  USING (
    public.get_my_role() = 'staff'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = tasks.assigned_user_id AND p.tasks_shared_with_team = TRUE
    )
  );
