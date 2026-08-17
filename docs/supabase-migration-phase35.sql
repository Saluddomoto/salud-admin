-- ================================================================
-- Phase 35 マイグレーション — 顧客削除をスタッフも含め全員可能に
-- これまでは admin/manager のみ削除可能で、staff がボタンを押しても
-- 権限エラーになっていた。運用上、担当者を問わず削除できるようにする。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

DROP POLICY "customers: manager+ delete" ON public.customers;

CREATE POLICY "customers: authenticated delete"
  ON public.customers FOR DELETE
  USING (auth.uid() IS NOT NULL);
