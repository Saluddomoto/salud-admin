-- ================================================================
-- Phase 24 マイグレーション — monthly_reports に不足していた tasks 列を追加
-- 原因: phase12 の CREATE TABLE には tasks 列が含まれていたが、本番に
-- 実際に適用された際にはこの列が無い状態で作成されていた（経緯不明）。
-- 2026-08-13、役員月報のタスク欄機能を追加した際にPostgRESTの
-- 「column monthly_reports.tasks does not exist」エラーで判明。
-- このエラーによりfetchMonthlyReportsが失敗し、Promise.allの巻き添えで
-- fetchExecutiveProfilesの結果も画面上は空になる(=他の役員の欄が
-- 表示されない)という副作用が出ていた。
-- 適用済み（Management APIで2026-08-13に直接実行済み。このファイルは記録用）
-- ================================================================

ALTER TABLE public.monthly_reports ADD COLUMN IF NOT EXISTS tasks TEXT;
