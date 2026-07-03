# Salud 基幹システム 設計ドキュメント

> 作成日: 2026-06-28
> ステータス: **承認待ち**

---

## 概要

株式会社Saludの基幹システムをモノレポ構成で構築する。  
MVPとして社内管理システムを先行リリースし、段階的に以下へ拡張する。

| フェーズ | 機能 |
|---------|------|
| MVP | 社内管理（案件・顧客・タスク・面談・書類） |
| v2 | Google連携（Calendar / Drive / Gmail） |
| v3 | LINE連携・通知 |
| v4 | AIエージェント（議事録・メール・申請書・チャット） |
| v5 | 顧客ポータル |
| v6 | 電子契約 |
| v7 | 営業管理・補助金管理 |
| v8 | 請求管理・会計連携・経営ダッシュボード |

---

## 1. システム全体構成

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Salud Monorepo  (Turborepo + pnpm)                    │
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────────┐ │
│  │  apps/admin  │   │ apps/portal  │   │         apps/api             │ │
│  │  社内管理    │   │  顧客ポータル │   │  APIサーバー / Webhookハンドラ│ │
│  │  ✅ MVP      │   │  将来        │   │  将来                        │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────────┬───────────────┘ │
│         │                  │                          │                 │
│         └──────────────────┴──────────────────────────┘                 │
│                                    │                                    │
│  ┌─────────────────────────────────▼──────────────────────────────────┐ │
│  │                         packages/ (共有コード)                      │ │
│  │   ui │ database │ auth │ ai │ line │ google │ notifications │ config│ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│                              Firebase 層                                  │
│                                                                          │
│  Firestore  │  Authentication  │  Storage  │  Cloud Functions  │  Hosting│
└──────────────────────────────────────────────────────────────────────────┘
                         │               │
         ┌───────────────┘               └──────────────────┐
         ▼                                                   ▼
  ┌─────────────┐                                   ┌──────────────┐
  │ Claude API  │                                   │  LINE API    │
  │ (Anthropic) │                                   │  Google API  │
  └─────────────┘                                   └──────────────┘
```

### 技術スタック

| レイヤー | 技術 | 選定理由 |
|--------|------|---------|
| モノレポ | **Turborepo** + **pnpm workspaces** | ビルドキャッシュ・並列実行・将来のアプリ追加に対応 |
| フレームワーク | **Next.js 14** (App Router) | admin・portal 共通。SSR/ISR対応 |
| 言語 | **TypeScript 5** | 全パッケージ統一。型共有による安全性 |
| スタイル | **Tailwind CSS** + **shadcn/ui** | デザイン一貫性・高速開発 |
| DB | **Firebase Firestore** | スキーマレス・リアルタイム・Firebase連携が容易 |
| 認証 | **Firebase Authentication** | メール → LINE/Google を後から追加可能 |
| ストレージ | **Firebase Storage** | 書類・契約書ファイル管理 |
| サーバー | **Firebase Cloud Functions** | 将来のWebhook・AI処理・バッチ処理 |
| ホスティング | **Firebase Hosting** / **Vercel** | CDN・プレビューデプロイ |
| AI | **Claude API (Anthropic)** | 議事録・メール・申請書・チャット |
| 通知 | **LINE Messaging API** | 案件・タスク・期限通知 |
| 外部連携 | **Google Workspace API** | Calendar・Drive・Gmail |
| 会計連携 | **freee API** / **マネーフォワード API** | 請求・仕訳連携（将来） |

---

## 2. ディレクトリ構成

```
Salud/                                        # モノレポルート
│
├── apps/
│   ├── admin/                                # ✅ MVP: 社内管理システム
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   └── login/page.tsx
│   │   │   │   ├── (main)/
│   │   │   │   │   ├── layout.tsx            # サイドバー + ヘッダー
│   │   │   │   │   ├── page.tsx              # ダッシュボード
│   │   │   │   │   ├── projects/             # 案件管理
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   ├── new/page.tsx
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       ├── page.tsx
│   │   │   │   │   │       └── edit/page.tsx
│   │   │   │   │   ├── customers/            # 顧客管理
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   ├── new/page.tsx
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       ├── page.tsx
│   │   │   │   │   │       └── edit/page.tsx
│   │   │   │   │   ├── tasks/                # タスク管理
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   └── [id]/page.tsx
│   │   │   │   │   ├── meetings/             # 面談管理
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   ├── new/page.tsx
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       ├── page.tsx
│   │   │   │   │   │       └── edit/page.tsx
│   │   │   │   │   ├── documents/            # 書類管理
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── settings/             # 設定
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── globals.css
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   ├── Header.tsx
│   │   │   │   │   └── PageHeader.tsx
│   │   │   │   └── features/                 # admin固有コンポーネント
│   │   │   │       ├── dashboard/
│   │   │   │       │   ├── StatCard.tsx
│   │   │   │       │   ├── TodayTasks.tsx
│   │   │   │       │   ├── WeekMeetings.tsx
│   │   │   │       │   └── ActiveProjects.tsx
│   │   │   │       ├── projects/
│   │   │   │       │   ├── ProjectForm.tsx
│   │   │   │       │   ├── ProjectStatusBadge.tsx
│   │   │   │       │   └── ProjectTimeline.tsx
│   │   │   │       ├── customers/
│   │   │   │       │   ├── CustomerForm.tsx
│   │   │   │       │   └── ContactForm.tsx
│   │   │   │       ├── tasks/
│   │   │   │       │   ├── TaskForm.tsx
│   │   │   │       │   └── TaskKanban.tsx
│   │   │   │       ├── meetings/
│   │   │   │       │   ├── MeetingForm.tsx
│   │   │   │       │   └── MinutesEditor.tsx
│   │   │   │       └── documents/
│   │   │   │           └── DocumentUploader.tsx
│   │   │   └── hooks/                        # admin固有フック
│   │   ├── .env.local
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── portal/                               # 将来: 顧客ポータル
│   │   └── ...
│   │
│   └── api/                                  # 将来: APIサーバー
│       └── ...                               # (LINE Webhook / AI処理 / バッチ)
│
├── packages/
│   │
│   ├── ui/                                   # 共通UIコンポーネント
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   ├── Textarea.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Table.tsx
│   │   │   │   ├── DatePicker.tsx
│   │   │   │   ├── FileUpload.tsx
│   │   │   │   ├── Avatar.tsx
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── package.json                      # name: "@salud/ui"
│   │   └── tsconfig.json
│   │
│   ├── database/                             # Firestore 型定義・サービス層
│   │   ├── src/
│   │   │   ├── types/                        # 全エンティティ型定義
│   │   │   │   ├── user.ts
│   │   │   │   ├── customer.ts
│   │   │   │   ├── project.ts
│   │   │   │   ├── task.ts
│   │   │   │   ├── meeting.ts
│   │   │   │   ├── document.ts
│   │   │   │   ├── contract.ts               # 将来: 電子契約
│   │   │   │   ├── invoice.ts                # 将来: 請求
│   │   │   │   ├── notification.ts           # 将来: 通知
│   │   │   │   └── index.ts
│   │   │   ├── services/                     # CRUD操作（UIから呼び出す）
│   │   │   │   ├── users.ts
│   │   │   │   ├── customers.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── tasks.ts
│   │   │   │   ├── meetings.ts
│   │   │   │   └── documents.ts
│   │   │   ├── firebase/                     # Firebase初期化
│   │   │   │   ├── config.ts
│   │   │   │   ├── firestore.ts
│   │   │   │   ├── auth.ts
│   │   │   │   └── storage.ts
│   │   │   └── index.ts
│   │   ├── package.json                      # name: "@salud/database"
│   │   └── tsconfig.json
│   │
│   ├── auth/                                 # 認証共通ロジック
│   │   ├── src/
│   │   │   ├── providers/
│   │   │   │   ├── email.ts                  # ✅ MVP
│   │   │   │   ├── line.ts                   # 将来: LINE Login
│   │   │   │   └── google.ts                 # 将来: Google Login
│   │   │   ├── AuthContext.tsx
│   │   │   ├── useAuth.ts
│   │   │   ├── guards.ts                     # 認証ガード
│   │   │   └── index.ts
│   │   ├── package.json                      # name: "@salud/auth"
│   │   └── tsconfig.json
│   │
│   ├── ai/                                   # 将来: AIエージェント
│   │   ├── src/
│   │   │   ├── client.ts                     # Claude API クライアント
│   │   │   ├── minutes.ts                    # AI議事録生成
│   │   │   ├── email.ts                      # AIメール生成
│   │   │   ├── application.ts                # AI申請書生成
│   │   │   ├── chat.ts                       # AIチャット
│   │   │   └── index.ts
│   │   ├── package.json                      # name: "@salud/ai"
│   │   └── tsconfig.json
│   │
│   ├── line/                                 # 将来: LINE連携
│   │   ├── src/
│   │   │   ├── messaging.ts                  # 通知送信
│   │   │   ├── login.ts                      # LINE Login
│   │   │   ├── webhook.ts                    # Webhookハンドラー
│   │   │   └── index.ts
│   │   ├── package.json                      # name: "@salud/line"
│   │   └── tsconfig.json
│   │
│   ├── google/                               # 将来: Google連携
│   │   ├── src/
│   │   │   ├── calendar.ts
│   │   │   ├── drive.ts
│   │   │   ├── gmail.ts
│   │   │   └── index.ts
│   │   ├── package.json                      # name: "@salud/google"
│   │   └── tsconfig.json
│   │
│   ├── notifications/                        # 将来: 通知基盤
│   │   ├── src/
│   │   │   ├── channels/
│   │   │   │   ├── line.ts
│   │   │   │   ├── email.ts
│   │   │   │   └── push.ts
│   │   │   ├── templates/
│   │   │   └── index.ts
│   │   ├── package.json                      # name: "@salud/notifications"
│   │   └── tsconfig.json
│   │
│   └── config/                               # 共通ツール設定
│       ├── eslint/index.js
│       ├── typescript/
│       │   ├── base.json
│       │   └── nextjs.json
│       └── tailwind/index.ts
│
├── docs/
│   ├── DESIGN.md                             # このファイル
│   ├── api/                                  # API仕様書
│   └── adr/                                  # アーキテクチャ決定記録
│
├── firestore.rules                           # セキュリティルール（全アプリ共通）
├── firestore.indexes.json
├── turbo.json                                # Turborepo設定
├── pnpm-workspace.yaml
├── package.json                              # ルートpackage.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 3. データベース設計（Firestore）

### コレクション全体像

```
firestore/
│
├── users/                      # 社内ユーザー ✅ MVP
├── customers/                  # 顧客企業 ✅ MVP
│   └── {id}/contacts/          # 顧客担当者（サブコレクション）
├── projects/                   # 案件 ✅ MVP
├── tasks/                      # タスク ✅ MVP
├── meetings/                   # 面談 ✅ MVP
├── documents/                  # 書類 ✅ MVP
│
├── contracts/                  # 電子契約 [v6]
├── invoices/                   # 請求書 [v8]
├── invoice_items/              # 請求明細 [v8]
├── sales_records/              # 売上記録 [v7]
├── notifications/              # 通知履歴 [v3]
├── ai_logs/                    # AI処理ログ [v4]
└── accounting_exports/         # 会計連携ログ [v8]
```

---

### `users` — 社内ユーザー

```typescript
interface User {
  uid: string                       // Firebase Auth UID（ドキュメントID）
  name: string
  nameKana: string
  email: string
  role: 'admin' | 'manager' | 'staff'
  department: string
  avatarUrl?: string
  isActive: boolean
  // 将来拡張フィールド（今から定義しておく）
  lineUserId?: string               // LINE連携
  googleRefreshToken?: string       // Google連携
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

### `customers` — 顧客企業

```typescript
interface Customer {
  id: string
  companyName: string
  companyNameKana: string
  industry: string
  postalCode: string
  prefecture: string
  city: string
  addressLine: string
  phone: string
  email: string
  website?: string
  assignedUserId: string            // 主担当者
  status: 'prospect' | 'active' | 'inactive'
  notes?: string
  // 将来拡張
  portalEnabled?: boolean           // 顧客ポータル有効化
  portalEmail?: string
  lineUserId?: string
  googleDriveFolderId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// サブコレクション: customers/{customerId}/contacts
interface Contact {
  id: string
  customerId: string
  name: string
  nameKana: string
  position: string
  department: string
  phone: string
  email: string
  isPrimary: boolean
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

### `projects` — 案件

```typescript
type ProjectStatus =
  | 'lead'          // リード
  | 'proposal'      // 提案中
  | 'in_progress'   // 申請準備中
  | 'reviewing'     // 審査中
  | 'submitted'     // 申請済み
  | 'approved'      // 採択
  | 'rejected'      // 不採択
  | 'closed'        // 完了

interface Project {
  id: string
  name: string
  customerId: string
  customerName: string              // 非正規化（一覧高速化）
  subsidyType: string               // 補助金種類
  subsidyCategory?: string          // 枠・類型
  subsidyYear?: string              // 公募回（例: "2024年度第3回"）
  status: ProjectStatus
  assignedUserIds: string[]
  primaryUserId: string
  deadline?: Timestamp              // 申請期限
  expectedAmount?: number           // 予定補助額（円）
  actualAmount?: number             // 確定補助額（円）
  nextAction?: string
  nextActionDate?: Timestamp
  description?: string
  tags: string[]
  // 将来拡張
  contractId?: string               // 電子契約 [v6]
  invoiceIds?: string[]             // 請求書 [v8]
  aiSummary?: string                // AI要約 [v4]
  googleDriveFolderId?: string      // Google Drive [v2]
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**ステータスフロー:**
```
lead → proposal → in_progress → submitted → approved ──→ closed
                                          └→ rejected ──→ closed
```

---

### `tasks` — タスク

```typescript
interface Task {
  id: string
  title: string
  description?: string
  projectId?: string
  customerId?: string
  assignedUserId: string
  createdByUserId: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  dueDate?: Timestamp
  completedAt?: Timestamp
  tags: string[]
  // 将来拡張
  sourceType?: 'manual' | 'ai_minutes' | 'line'   // [v3][v4]
  aiGenerated?: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

### `meetings` — 面談

```typescript
interface ActionItem {
  id: string
  content: string
  assignedUserId?: string
  dueDate?: Timestamp
  isDone: boolean
}

interface Meeting {
  id: string
  title: string
  projectId?: string
  customerId?: string
  customerName?: string             // 非正規化
  internalAttendees: string[]       // 社内参加者 userIds
  externalAttendees: string[]       // 顧客参加者名
  startAt: Timestamp
  endAt?: Timestamp
  location?: string
  status: 'scheduled' | 'completed' | 'cancelled'
  agenda?: string
  minutes?: string                  // 議事録（Markdown）
  actionItems: ActionItem[]
  createdByUserId: string
  // 将来拡張
  aiMinutes?: string                // AI議事録 [v4]
  recordingUrl?: string
  googleCalendarEventId?: string    // Google Calendar [v2]
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

### `documents` — 書類

```typescript
interface Document {
  id: string
  displayName: string
  originalName: string
  storagePath: string               // Firebase Storage パス
  downloadUrl: string
  mimeType: string
  fileSize: number
  projectId?: string
  customerId?: string
  category: string                  // '申請書類'|'契約書'|'見積書'|'その他'
  uploadedByUserId: string
  tags: string[]
  // 将来拡張
  electronicSignatureStatus?: 'pending' | 'signed' | 'rejected'  // [v6]
  googleDriveFileId?: string        // [v2]
  aiExtractedData?: Record<string, unknown>                       // [v4]
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

### `contracts` — 電子契約 [v6]

```typescript
interface Contract {
  id: string
  projectId: string
  customerId: string
  title: string
  status: 'draft' | 'sent' | 'signed' | 'rejected' | 'expired'
  signatories: Signatory[]
  documentUrl: string
  signedAt?: Timestamp
  expiresAt?: Timestamp
  createdByUserId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

### `invoices` — 請求書 [v8]

```typescript
interface Invoice {
  id: string
  projectId?: string
  customerId: string
  customerName: string
  invoiceNumber: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  issueDate: Timestamp
  dueDate: Timestamp
  subtotal: number
  taxAmount: number
  total: number
  notes?: string
  accountingExportedAt?: Timestamp  // 会計連携 [v8]
  createdByUserId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

### セキュリティルール方針

| ロール | 権限 |
|-------|------|
| 未認証 | 全アクセス拒否 |
| `staff` | 自分が担当する案件・タスクのみ読み書き（削除不可） |
| `manager` | 全データ読み書き（削除不可） |
| `admin` | 全権限（ユーザー管理・削除含む） |
| `portal_user`（将来） | 自社に紐づくデータのみ読み取り |

---

## 4. 画面一覧（MVP: apps/admin）

### 認証

| ID | 画面名 | パス |
|----|-------|------|
| A-1 | ログイン | `/login` |

### ダッシュボード

| ID | 画面名 | パス | 主なコンテンツ |
|----|-------|------|-------------|
| D-1 | ダッシュボード | `/` | 案件数・売上KPI・本日のタスク・今週の面談・進行中案件 |

### 案件管理

| ID | 画面名 | パス |
|----|-------|------|
| P-1 | 案件一覧 | `/projects` |
| P-2 | 案件詳細 | `/projects/[id]` |
| P-3 | 案件作成 | `/projects/new` |
| P-4 | 案件編集 | `/projects/[id]/edit` |

### 顧客管理

| ID | 画面名 | パス |
|----|-------|------|
| C-1 | 顧客一覧 | `/customers` |
| C-2 | 顧客詳細 | `/customers/[id]` |
| C-3 | 顧客作成 | `/customers/new` |
| C-4 | 顧客編集 | `/customers/[id]/edit` |

### タスク管理

| ID | 画面名 | パス |
|----|-------|------|
| T-1 | タスク一覧 | `/tasks` |
| T-2 | タスク詳細 | `/tasks/[id]` |

### 面談管理

| ID | 画面名 | パス |
|----|-------|------|
| M-1 | 面談一覧 | `/meetings` |
| M-2 | 面談詳細 | `/meetings/[id]` |
| M-3 | 面談作成 | `/meetings/new` |
| M-4 | 面談編集 | `/meetings/[id]/edit` |

### 書類管理

| ID | 画面名 | パス |
|----|-------|------|
| Doc-1 | 書類一覧 | `/documents` |

### 設定

| ID | 画面名 | パス |
|----|-------|------|
| S-1 | 設定（ユーザー・マスタ管理） | `/settings` |

---

## 5. 開発ロードマップ

### ✅ MVP — 社内管理システム

#### Phase 0: モノレポ環境構築
- pnpm + Turborepo セットアップ
- `packages/config`（ESLint・TypeScript・Tailwind 共通設定）
- `.env.example` 作成
- Firebaseプロジェクト作成（コンソールで手動）
- Git初期化・`.gitignore`

#### Phase 1: 共通パッケージ
- `packages/database` — 型定義・Firebase初期化・サービス層
- `packages/auth` — AuthContext・useAuth・メール認証
- `packages/ui` — Button / Card / Badge / Input / Select / Modal / Table / DatePicker

#### Phase 2: admin — 認証・共通レイアウト
- Next.js 14 プロジェクト作成
- ログイン画面
- サイドバー・ヘッダー共通レイアウト
- 認証ガード（未ログインリダイレクト）

#### Phase 3: admin — 案件管理
- 案件一覧（ステータス・担当者・補助金種別フィルター）
- 案件詳細（概要 / タスク / 面談 / 書類 タブ）
- 案件作成・編集フォーム

#### Phase 4: admin — 顧客管理
- 顧客一覧・詳細・作成・編集
- 担当者（Contact）CRUD
- 顧客詳細 → 関連案件リスト

#### Phase 5: admin — タスク管理
- タスク一覧（リスト + カンバン切替）
- タスク作成・編集・完了操作

#### Phase 6: admin — 面談管理
- 面談一覧（リスト + カレンダービュー）
- 面談詳細・議事録エディタ（Markdown）
- アクションアイテム管理

#### Phase 7: admin — 書類管理
- Firebase Storage セットアップ
- ファイルアップロード・ダウンロード
- 案件・顧客への紐づけ

#### Phase 8: admin — ダッシュボード完成
- KPIカード（案件数・売上）
- 本日のタスク・今週の面談
- 進行中案件一覧

#### Phase 9: 品質・デプロイ
- レスポンシブ対応（モバイル・タブレット）
- Firestoreセキュリティルール本番設定
- Firebase Hosting デプロイ

---

### 将来バージョン

| バージョン | 機能 | 追加・変更するパッケージ/アプリ |
|-----------|------|-------------------------------|
| **v2** | Google Calendar・Drive・Gmail連携 | `packages/google` 新規 → `apps/admin` に追加 |
| **v3** | LINE通知（案件・タスク・期限） | `packages/line` 新規 → `apps/admin` に追加 |
| **v4** | AIエージェント（議事録・メール・申請書・チャット） | `packages/ai` 新規 → `apps/admin` に追加 |
| **v5** | 顧客ポータル | `apps/portal` 新規 |
| **v5.1** | LINEログイン（ポータル） | `packages/auth` に provider 追加 |
| **v6** | 電子契約 | `apps/admin` に追加・`contracts` コレクション |
| **v7** | 営業管理・補助金詳細管理 | `apps/admin` に追加 |
| **v8** | 請求管理 | `apps/admin` に追加・`invoices` コレクション |
| **v8.1** | 会計連携（freee / マネーフォワード） | `packages/accounting` 新規 |
| **v9** | 経営ダッシュボード | `apps/admin` に追加 |

---

## 承認チェックリスト

以下をご確認の上、承認いただければ **Phase 0（モノレポ環境構築）** から実装を開始します。

- [ ] モノレポ構成（Turborepo + pnpm）でよいか
- [ ] `packages/` の分割粒度は適切か
- [ ] データベース設計のフィールドに過不足はないか
- [ ] MVPの画面・機能範囲でよいか
- [ ] 将来バージョンの拡張計画は合っているか
- [ ] 既存の `server.js` 等のファイルは削除してよいか
