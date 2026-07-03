-- ================================================================
-- Salud 基幹システム — Supabase PostgreSQL スキーマ
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- ================================================================

-- ----------------------------------------------------------------
-- 1. ENUM 型
-- ----------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'customer');
CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'prospect');
CREATE TYPE project_status AS ENUM ('planning', 'in_progress', 'submitted', 'accepted', 'rejected', 'completed');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

-- ----------------------------------------------------------------
-- 2. profiles テーブル（auth.users を拡張）
-- ----------------------------------------------------------------
CREATE TABLE public.profiles (
  id              UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name       TEXT        NOT NULL DEFAULT '',
  full_name_kana  TEXT        NOT NULL DEFAULT '',
  role            user_role   NOT NULL DEFAULT 'staff',
  department      TEXT,
  avatar_url      TEXT,
  line_user_id    TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 3. ロール取得ヘルパー関数（RLS で使用 — profiles より後に定義）
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- ----------------------------------------------------------------
-- 4. profiles の RLS
-- ----------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: manager+ read all"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles: admin all"
  ON public.profiles FOR ALL
  USING (public.get_my_role() = 'admin');

-- ----------------------------------------------------------------
-- 5. ユーザー登録時に profiles を自動作成するトリガー
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'staff')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------
-- 6. customers テーブル
-- ----------------------------------------------------------------
CREATE TABLE public.customers (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name      TEXT            NOT NULL,
  company_name_kana TEXT            NOT NULL DEFAULT '',
  industry          TEXT,
  employee_count    INTEGER,
  annual_revenue    BIGINT,
  status            customer_status NOT NULL DEFAULT 'active',
  assigned_user_id  UUID            REFERENCES public.profiles(id),
  postal_code       TEXT,
  address           TEXT,
  phone             TEXT,
  website           TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers: manager+ read all"
  ON public.customers FOR SELECT
  USING (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "customers: staff read assigned"
  ON public.customers FOR SELECT
  USING (assigned_user_id = auth.uid() AND public.get_my_role() = 'staff');

CREATE POLICY "customers: staff+ insert"
  ON public.customers FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'manager', 'staff'));

CREATE POLICY "customers: manager+ update"
  ON public.customers FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "customers: staff update assigned"
  ON public.customers FOR UPDATE
  USING (assigned_user_id = auth.uid() AND public.get_my_role() = 'staff');

CREATE POLICY "customers: manager+ delete"
  ON public.customers FOR DELETE
  USING (public.get_my_role() IN ('admin', 'manager'));

-- ----------------------------------------------------------------
-- 7. customer_contacts テーブル
-- ----------------------------------------------------------------
CREATE TABLE public.customer_contacts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  name_kana   TEXT,
  title       TEXT,
  email       TEXT,
  phone       TEXT,
  is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts: follow customer access"
  ON public.customer_contacts FOR ALL
  USING (customer_id IN (SELECT id FROM public.customers));

-- ----------------------------------------------------------------
-- 8. projects テーブル
-- ----------------------------------------------------------------
CREATE TABLE public.projects (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID           NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title            TEXT           NOT NULL,
  subsidy_name     TEXT           NOT NULL,
  status           project_status NOT NULL DEFAULT 'planning',
  assigned_user_id UUID           REFERENCES public.profiles(id),
  applied_amount   BIGINT,
  subsidy_amount   BIGINT,
  deadline         DATE,
  submitted_at     DATE,
  result_at        DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: manager+ read all"
  ON public.projects FOR SELECT
  USING (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "projects: staff read assigned"
  ON public.projects FOR SELECT
  USING (assigned_user_id = auth.uid() AND public.get_my_role() = 'staff');

CREATE POLICY "projects: staff+ insert"
  ON public.projects FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'manager', 'staff'));

CREATE POLICY "projects: manager+ update"
  ON public.projects FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "projects: staff update assigned"
  ON public.projects FOR UPDATE
  USING (assigned_user_id = auth.uid() AND public.get_my_role() = 'staff');

CREATE POLICY "projects: manager+ delete"
  ON public.projects FOR DELETE
  USING (public.get_my_role() IN ('admin', 'manager'));

-- ----------------------------------------------------------------
-- 9. tasks テーブル
-- ----------------------------------------------------------------
CREATE TABLE public.tasks (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID          REFERENCES public.projects(id) ON DELETE SET NULL,
  customer_id      UUID          REFERENCES public.customers(id) ON DELETE SET NULL,
  title            TEXT          NOT NULL,
  description      TEXT,
  status           task_status   NOT NULL DEFAULT 'todo',
  priority         task_priority NOT NULL DEFAULT 'medium',
  assigned_user_id UUID          REFERENCES public.profiles(id),
  due_date         DATE,
  created_by       UUID          REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks: manager+ read all"
  ON public.tasks FOR SELECT
  USING (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "tasks: staff read own"
  ON public.tasks FOR SELECT
  USING (
    (assigned_user_id = auth.uid() OR created_by = auth.uid())
    AND public.get_my_role() = 'staff'
  );

CREATE POLICY "tasks: staff+ insert"
  ON public.tasks FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'manager', 'staff'));

CREATE POLICY "tasks: manager+ update"
  ON public.tasks FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'manager'));

CREATE POLICY "tasks: staff update assigned"
  ON public.tasks FOR UPDATE
  USING (assigned_user_id = auth.uid() AND public.get_my_role() = 'staff');

CREATE POLICY "tasks: manager+ delete"
  ON public.tasks FOR DELETE
  USING (public.get_my_role() IN ('admin', 'manager'));

-- ----------------------------------------------------------------
-- 10. updated_at 自動更新トリガー
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------
-- 11. インデックス
-- ----------------------------------------------------------------
CREATE INDEX idx_customers_assigned  ON public.customers (assigned_user_id);
CREATE INDEX idx_customers_status    ON public.customers (status);
CREATE INDEX idx_projects_customer   ON public.projects  (customer_id);
CREATE INDEX idx_projects_assigned   ON public.projects  (assigned_user_id);
CREATE INDEX idx_projects_status     ON public.projects  (status);
CREATE INDEX idx_tasks_assigned      ON public.tasks     (assigned_user_id);
CREATE INDEX idx_tasks_project       ON public.tasks     (project_id);
CREATE INDEX idx_tasks_status        ON public.tasks     (status);
