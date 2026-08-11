-- ================================================================
-- Phase 22 マイグレーション
-- 適用済みの supabase-schema.sql + phase3〜21 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- staff の閲覧範囲を「担当のみ」から「全件」に拡大（顧客管理・案件管理）。
-- 編集・削除の権限は変更しない（staffは引き続き自分の担当分のみ編集可、削除はmanager+のみ）。

DROP POLICY IF EXISTS "customers: staff read assigned" ON public.customers;
CREATE POLICY "customers: staff read all"
  ON public.customers FOR SELECT
  USING (public.get_my_role() = 'staff');

DROP POLICY IF EXISTS "projects: staff read assigned" ON public.projects;
CREATE POLICY "projects: staff read all"
  ON public.projects FOR SELECT
  USING (public.get_my_role() = 'staff');
