-- ================================================================
-- デモ用シードデータ（任意）
-- Supabase SQL Editor で実行すると、画面確認用のサンプルデータが入ります
-- 空の状態から自分で登録する場合は実行不要です
-- ================================================================

-- 顧客
INSERT INTO public.customers (id, company_name, company_name_kana, industry, employee_count, status, phone, assigned_user_id) VALUES
  ('11111111-1111-1111-1111-111111111101', '株式会社山田製作所', 'ヤマダセイサクショ', '製造業',     45, 'active',   '03-1234-5678', (SELECT id FROM public.profiles LIMIT 1)),
  ('11111111-1111-1111-1111-111111111102', '有限会社鈴木商店',   'スズキショウテン',   '小売業',     12, 'active',   '03-2345-6789', (SELECT id FROM public.profiles LIMIT 1)),
  ('11111111-1111-1111-1111-111111111103', '合同会社テックス',   'テックス',           'IT',          8, 'active',   '03-3456-7890', (SELECT id FROM public.profiles LIMIT 1)),
  ('11111111-1111-1111-1111-111111111104', '株式会社ABC',        'エービーシー',       'サービス業', 30, 'active',   '03-4567-8901', (SELECT id FROM public.profiles LIMIT 1)),
  ('11111111-1111-1111-1111-111111111105', '株式会社北陸物流',   'ホクリクブツリュウ', '運送業',     65, 'prospect', '076-123-4567', (SELECT id FROM public.profiles LIMIT 1));

-- 顧客担当者
INSERT INTO public.customer_contacts (customer_id, name, is_primary) VALUES
  ('11111111-1111-1111-1111-111111111101', '山田 太郎', TRUE),
  ('11111111-1111-1111-1111-111111111102', '鈴木 花子', TRUE),
  ('11111111-1111-1111-1111-111111111103', '高橋 健一', TRUE),
  ('11111111-1111-1111-1111-111111111104', '伊藤 美咲', TRUE),
  ('11111111-1111-1111-1111-111111111105', '中村 大輔', TRUE);

-- 案件
INSERT INTO public.projects (id, customer_id, title, subsidy_name, status, applied_amount, deadline, assigned_user_id) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'ものづくり補助金 第17回', 'ものづくり補助金', 'in_progress', 12500000, '2026-07-15', (SELECT id FROM public.profiles LIMIT 1)),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', 'IT導入補助金 2026',       'IT導入補助金',     'in_progress',  4500000, '2026-07-20', (SELECT id FROM public.profiles LIMIT 1)),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111103', '小規模事業者持続化補助金', '持続化補助金',     'planning',     2000000, '2026-08-01', (SELECT id FROM public.profiles LIMIT 1)),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111105', '省力化投資補助金',         '省力化投資補助金', 'submitted',    8000000, '2026-07-10', (SELECT id FROM public.profiles LIMIT 1)),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111104', 'IT導入補助金 2025',        'IT導入補助金',     'accepted',     3500000, '2026-05-15', (SELECT id FROM public.profiles LIMIT 1));

-- タスク
INSERT INTO public.tasks (project_id, title, status, priority, due_date, assigned_user_id, created_by) VALUES
  ('22222222-2222-2222-2222-222222222201', '申請書類の最終確認',     'in_progress', 'high',   '2026-07-05', (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  ('22222222-2222-2222-2222-222222222202', '見積書の収集',           'in_progress', 'medium', '2026-07-08', (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  ('22222222-2222-2222-2222-222222222203', '事業計画書ドラフト作成', 'todo',        'medium', '2026-07-12', (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  ('22222222-2222-2222-2222-222222222204', '決算書3期分の受領',      'todo',        'high',   '2026-07-06', (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  ('22222222-2222-2222-2222-222222222205', '交付申請の準備',         'todo',        'medium', '2026-07-20', (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1)),
  (NULL,                                    '週次ミーティング議事録', 'done',        'low',    '2026-07-01', (SELECT id FROM public.profiles LIMIT 1), (SELECT id FROM public.profiles LIMIT 1));
