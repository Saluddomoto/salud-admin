-- ================================================================
-- Phase 10 マイグレーション — 完了タスクは本人も削除可能に
-- 適用済みの supabase-schema.sql + phase3〜9 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- admin/manager は既存ポリシーで任意のタスクを削除可能（変更なし）。
-- staff は「完了」ステータスの自分のタスクに限り削除できるようにする。
CREATE POLICY "tasks: staff delete own done"
  ON public.tasks FOR DELETE
  USING (
    public.get_my_role() = 'staff'
    AND status = 'done'
    AND (assigned_user_id = auth.uid() OR created_by = auth.uid())
  );
