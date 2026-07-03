// モックデータ — Phase 2 で Supabase のデータに差し替える
// 各ページはこのモジュールだけを参照しているため、
// 差し替え時はここを services 呼び出しに置換すればよい

export interface MockCustomer {
  id: string
  companyName: string
  contactName: string
  industry: string
  employeeCount: number
  status: 'active' | 'prospect' | 'inactive'
  assignee: string
  phone: string
  lastContact: string
}

export const mockCustomers: MockCustomer[] = [
  { id: 'c1', companyName: '株式会社山田製作所', contactName: '山田 太郎', industry: '製造業', employeeCount: 45, status: 'active',   assignee: '佐藤', phone: '03-1234-5678', lastContact: '2026-06-25' },
  { id: 'c2', companyName: '有限会社鈴木商店',   contactName: '鈴木 花子', industry: '小売業', employeeCount: 12, status: 'active',   assignee: '田中', phone: '03-2345-6789', lastContact: '2026-06-27' },
  { id: 'c3', companyName: '合同会社テックス',   contactName: '高橋 健一', industry: 'IT',     employeeCount: 8,  status: 'active',   assignee: '佐藤', phone: '03-3456-7890', lastContact: '2026-06-20' },
  { id: 'c4', companyName: '株式会社ABC',        contactName: '伊藤 美咲', industry: 'サービス業', employeeCount: 30, status: 'active', assignee: '山本', phone: '03-4567-8901', lastContact: '2026-06-15' },
  { id: 'c5', companyName: '株式会社グリーンファーム', contactName: '渡辺 誠', industry: '農業', employeeCount: 20, status: 'prospect', assignee: '田中', phone: '03-5678-9012', lastContact: '2026-06-10' },
  { id: 'c6', companyName: '株式会社北陸物流',   contactName: '中村 大輔', industry: '運送業', employeeCount: 65, status: 'prospect', assignee: '佐藤', phone: '076-123-4567', lastContact: '2026-06-05' },
  { id: 'c7', companyName: '株式会社さくら建設', contactName: '小林 直子', industry: '建設業', employeeCount: 38, status: 'inactive', assignee: '山本', phone: '03-6789-0123', lastContact: '2026-04-28' },
]

export type ProjectColumn = 'planning' | 'in_progress' | 'submitted' | 'accepted'

export interface MockProject {
  id: string
  title: string
  customer: string
  subsidy: string
  amount: string
  deadline: string
  assignee: string
  status: ProjectColumn
  priority: '高' | '中' | '低'
}

export const mockProjects: MockProject[] = [
  { id: 'p1', title: 'ものづくり補助金 第17回', customer: '山田製作所',   subsidy: 'ものづくり補助金', amount: '¥1,250万', deadline: '2026-07-01', assignee: '佐藤', status: 'in_progress', priority: '高' },
  { id: 'p2', title: 'IT導入補助金 2026',       customer: '鈴木商店',     subsidy: 'IT導入補助金',     amount: '¥450万',   deadline: '2026-07-06', assignee: '田中', status: 'in_progress', priority: '中' },
  { id: 'p3', title: '小規模事業者持続化補助金', customer: 'テックス',     subsidy: '持続化補助金',     amount: '¥200万',   deadline: '2026-07-11', assignee: '佐藤', status: 'planning',    priority: '中' },
  { id: 'p4', title: '事業再構築補助金',         customer: 'ABC',          subsidy: '事業再構築補助金', amount: '¥3,000万', deadline: '2026-08-20', assignee: '山本', status: 'planning',    priority: '低' },
  { id: 'p5', title: '省力化投資補助金',         customer: '北陸物流',     subsidy: '省力化投資補助金', amount: '¥800万',   deadline: '2026-06-30', assignee: '佐藤', status: 'submitted',   priority: '高' },
  { id: 'p6', title: 'IT導入補助金 2025',        customer: 'ABC',          subsidy: 'IT導入補助金',     amount: '¥350万',   deadline: '2026-05-15', assignee: '田中', status: 'accepted',    priority: '中' },
  { id: 'p7', title: '小規模持続化 第15回',      customer: 'グリーンファーム', subsidy: '持続化補助金', amount: '¥150万',   deadline: '2026-04-30', assignee: '山本', status: 'accepted',    priority: '低' },
]

export interface MockTask {
  id: string
  title: string
  related: string
  assignee: string
  due: string
  priority: '高' | '中' | '低'
  status: 'todo' | 'in_progress' | 'done'
}

export const mockTasks: MockTask[] = [
  { id: 't1', title: '申請書類の最終確認',       related: '山田製作所 / ものづくり補助金', assignee: '佐藤', due: '2026-06-30', priority: '高', status: 'in_progress' },
  { id: 't2', title: '見積書の収集',             related: '鈴木商店 / IT導入補助金',       assignee: '田中', due: '2026-07-02', priority: '中', status: 'in_progress' },
  { id: 't3', title: '事業計画書ドラフト作成',   related: 'テックス / 持続化補助金',       assignee: '佐藤', due: '2026-07-05', priority: '中', status: 'todo' },
  { id: 't4', title: 'キックオフMTG日程調整',    related: 'ABC / 事業再構築補助金',        assignee: '山本', due: '2026-07-08', priority: '低', status: 'todo' },
  { id: 't5', title: '決算書3期分の受領',        related: '北陸物流 / 省力化投資補助金',   assignee: '佐藤', due: '2026-07-01', priority: '高', status: 'todo' },
  { id: 't6', title: '交付申請の準備',           related: 'ABC / IT導入補助金2025',        assignee: '田中', due: '2026-07-15', priority: '中', status: 'todo' },
  { id: 't7', title: '週次ミーティング議事録',   related: '社内',                          assignee: '山本', due: '2026-06-27', priority: '低', status: 'done' },
  { id: 't8', title: '実績報告書の提出',         related: 'グリーンファーム / 持続化補助金', assignee: '山本', due: '2026-06-25', priority: '高', status: 'done' },
]

export interface MockMessage {
  id: string
  channel: 'LINE' | 'メール' | 'Web'
  sender: string
  company: string
  preview: string
  receivedAt: string
  read: boolean
  converted: '' | 'project' | 'task' | 'event'
}

export const mockMessages: MockMessage[] = [
  { id: 'm1', channel: 'LINE',   sender: '山田 太郎', company: '山田製作所',     preview: '書類の件、確認しました。明日までに残りをお送りします。', receivedAt: '10:24', read: false, converted: '' },
  { id: 'm2', channel: 'メール', sender: '鈴木 花子', company: '鈴木商店',       preview: '見積書を添付いたします。ご確認のほどよろしくお願いいたします。', receivedAt: '09:41', read: false, converted: '' },
  { id: 'm3', channel: 'Web',    sender: '斎藤 隆',   company: '（新規問い合わせ）', preview: 'ものづくり補助金の申請サポートについて相談したいのですが…', receivedAt: '09:02', read: false, converted: '' },
  { id: 'm4', channel: 'LINE',   sender: '高橋 健一', company: 'テックス',       preview: '来週の打ち合わせ、水曜14時でお願いできますか？', receivedAt: '昨日', read: true, converted: 'event' },
  { id: 'm5', channel: 'メール', sender: '伊藤 美咲', company: 'ABC',            preview: '交付決定通知書が届きました。今後の手続きについて教えてください。', receivedAt: '昨日', read: true, converted: 'task' },
  { id: 'm6', channel: 'Web',    sender: '中村 大輔', company: '北陸物流',       preview: '省力化投資補助金の対象になるか確認をお願いしたく…', receivedAt: '6/26', read: true, converted: 'project' },
]

export interface MockEvent {
  id: string
  title: string
  date: string   // YYYY-MM-DD
  start: string
  end: string
  category: '商談' | '面談' | '締切' | '社内'
  assignee: string
  color: string
}

export const mockEvents: MockEvent[] = [
  { id: 'e1', title: '朝礼・進捗確認',                 date: '2026-07-03', start: '09:00', end: '09:30', category: '社内', assignee: '全員', color: '#64748b' },
  { id: 'e2', title: '山田製作所 書類最終確認',        date: '2026-07-03', start: '14:00', end: '15:30', category: '面談', assignee: '佐藤', color: '#6366f1' },
  { id: 'e3', title: 'IT補助金 電話相談（鈴木商店）',  date: '2026-07-03', start: '16:30', end: '17:00', category: '商談', assignee: '田中', color: '#f59e0b' },
  { id: 'e4', title: 'テックス 打ち合わせ',            date: '2026-07-08', start: '14:00', end: '15:00', category: '商談', assignee: '佐藤', color: '#f59e0b' },
  { id: 'e5', title: 'ものづくり補助金 申請締切',      date: '2026-07-01', start: '17:00', end: '17:00', category: '締切', assignee: '佐藤', color: '#ef4444' },
  { id: 'e6', title: 'IT導入補助金 申請締切',          date: '2026-07-06', start: '17:00', end: '17:00', category: '締切', assignee: '田中', color: '#ef4444' },
  { id: 'e7', title: '新規顧客ヒアリング（斎藤様）',   date: '2026-07-04', start: '10:00', end: '11:00', category: '商談', assignee: '山本', color: '#f59e0b' },
  { id: 'e8', title: '週次ミーティング',               date: '2026-07-06', start: '09:30', end: '10:30', category: '社内', assignee: '全員', color: '#64748b' },
]

export const mockMembers = [
  { name: '佐藤 一郎', email: 'sato@salud.co.jp',   role: 'admin',   department: 'コンサルティング部' },
  { name: '田中 二郎', email: 'tanaka@salud.co.jp', role: 'manager', department: 'コンサルティング部' },
  { name: '山本 三子', email: 'yamamoto@salud.co.jp', role: 'staff', department: '管理部' },
]
