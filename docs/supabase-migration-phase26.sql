-- ================================================================
-- Phase 26 マイグレーション — LINEグループ発言のAIタスク自動抽出
-- グループ内の発言をAI(Haiku)判定し、タスク候補を「下書き」としてtasksに
-- 挿入する機能のための列追加。下書き = source='ai_line' AND reviewed_at IS NULL。
-- 承認時にreviewed_atをセットして通常タスクとして扱う。却下時は行を削除。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai_line')),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- 既存タスク(すべて手動作成)は承認済み扱いにしておく
UPDATE public.tasks SET reviewed_at = created_at WHERE reviewed_at IS NULL;
