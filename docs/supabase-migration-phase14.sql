-- ================================================================
-- Phase 14 マイグレーション
-- 適用済みの supabase-schema.sql + phase3〜13 に追加で、
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- 1. 顧客の「社内担当」を staff が自分以外に変更すると RLS 違反になる不具合の修正
--    （UPDATE ポリシーに WITH CHECK が無いため USING が暗黙適用され、
--    　更新後の行も assigned_user_id = auth.uid() を要求してしまっていた）
DROP POLICY "customers: staff update assigned" ON public.customers;

CREATE POLICY "customers: staff update assigned"
  ON public.customers FOR UPDATE
  USING (assigned_user_id = auth.uid() AND public.get_my_role() = 'staff')
  WITH CHECK (public.get_my_role() = 'staff');

-- 2. staff が「社内担当」ドロップダウン等で全メンバーを選べるよう、
--    在籍中(is_active)の全プロフィールを staff 以上に公開する
CREATE POLICY "profiles: staff+ read active roster"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() IN ('staff', 'manager', 'admin')
    AND is_active = TRUE
  );

-- 3. 顧客情報にメールアドレス欄を追加
ALTER TABLE public.customers
  ADD COLUMN email TEXT;
