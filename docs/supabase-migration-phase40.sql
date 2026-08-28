-- ================================================================
-- Phase 40 マイグレーション — 役員月報を「目標管理型」に拡張
-- 月報を 今月の振り返り／目標への進捗／月末会議／来月の計画 の4ブロックに
-- 再構成するための追加項目。既存列（actions/sales/tasks/initiatives）は
-- 一切変更しない。すべてNULL許容・デフォルトなしなので、既存の月報行は
-- そのまま新項目が空欄の状態で表示される（8月分の移行データも無傷）。
-- また、profiles に「今年の目標」（質的な年間目標、数値の
-- annual_target_amount とは別物）を追加し、月報画面から参照する。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

ALTER TABLE public.monthly_reports
  ADD COLUMN IF NOT EXISTS goal_progress      TEXT, -- ⑤ 年間目標に対する今月の進捗
  ADD COLUMN IF NOT EXISTS challenges         TEXT, -- ⑥ 現在の課題
  ADD COLUMN IF NOT EXISTS discussion_topics  TEXT, -- ⑦ 月末会議で議論したいこと
  ADD COLUMN IF NOT EXISTS next_month_actions TEXT, -- ⑧ 来月取り組むこと
  ADD COLUMN IF NOT EXISTS next_month_outcome TEXT, -- ⑨ 来月の成果（状態）
  ADD COLUMN IF NOT EXISTS support_needed     TEXT; -- ⑩ 必要なサポート

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS annual_goal TEXT; -- 今年の目標（質的テキスト。設定＞プロフィールで本人編集）
