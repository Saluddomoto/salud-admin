-- ================================================================
-- Phase 33 マイグレーション — 代理店登録管理表
-- 代理店募集用Googleフォームの回答（別スプレッドシート）を自動取込みし、
-- 既存の手動リスト（約20社）も初期データとして取り込む。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

CREATE TABLE public.partner_agencies (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source                   TEXT        NOT NULL DEFAULT 'manual', -- 'form'(フォーム自動取込) | 'manual'(画面から追加) | 'legacy_sheet'(既存シートの初期取込)
  form_timestamp           TEXT,       -- Googleフォーム回答のタイムスタンプ文字列（重複防止の突合キー、source='form'のみ）

  company_name             TEXT        NOT NULL,
  contact_person           TEXT,
  email                    TEXT,
  phone                    TEXT,
  hp_url                   TEXT,
  address                  TEXT,

  business_description     TEXT,
  customer_count           TEXT,
  sales_staff_count        TEXT,
  customer_industries      TEXT,
  customer_regions         TEXT,
  desired_collaboration    TEXT,
  desired_support          TEXT,
  seminar_cooperation      TEXT,
  seminar_reachable_count  TEXT,
  annual_referral_estimate TEXT,
  has_current_prospects    TEXT,
  target_customer_profile  TEXT,
  meeting_notes             TEXT,
  info_delivery_method     TEXT,

  note                     TEXT,       -- 社内メモ（画面から自由記入）

  created_by  UUID        REFERENCES public.profiles(id),
  updated_by  UUID        REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.partner_agencies ENABLE ROW LEVEL SECURITY;

-- ログインしていれば誰でも閲覧・追加・編集・削除できる（ノウハウノートと同じオープン方針）
CREATE POLICY "partner_agencies: authenticated read"
  ON public.partner_agencies FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "partner_agencies: authenticated insert"
  ON public.partner_agencies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "partner_agencies: authenticated update"
  ON public.partner_agencies FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "partner_agencies: authenticated delete"
  ON public.partner_agencies FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_partner_agencies_updated_at
  BEFORE UPDATE ON public.partner_agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
