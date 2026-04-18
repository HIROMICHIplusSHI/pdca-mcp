# PDCA MCP サーバー設計書

## 概要

PDCA報告アプリのMCPサーバー。Claude Code / Claude Desktop から直接PDCAデータを操作できるようにすることで、CLI経由のBash呼び出しを不要にし、シームレスな対話体験を実現する。

## 背景と目的

### 現状の課題

- Claude Code上でPDCAアプリを操作するには、CLI（pdca-cli）をBashツール経由で実行する必要がある
- 毎回ターミナル操作が介在し、対話がシームレスでない
- CLIのログインも別途ターミナルから行う必要がある

### 目的

- MCPプロトコルでPDCA APIを公開し、Claudeがツールとして直接呼び出せるようにする
- ログインからレポート作成・確認まで、全て対話ベースで完結させる
- 講師・受講生のロールに応じたアクセス制御はAPIサーバー側で担保

## 利用者

| ロール | 利用シーン |
|--------|-----------|
| 受講生 | 日次レポート作成・更新、週次目標管理、学習計画確認 |
| 講師 | 受講生の進捗確認、レポート閲覧、ダッシュボード参照 |

## アーキテクチャ

```
┌─────────────────┐     stdio / Streamable HTTP
│  Claude Code /  │◄──────────────────────────►┌──────────────┐
│  Claude Desktop │    MCP Protocol            │  pdca-mcp    │
└─────────────────┘                            │  (TypeScript)│
                                               └──────┬───────┘
                                                      │ HTTP (fetch)
                                                      ▼
                                               ┌──────────────┐
                                               │  Rails API   │
                                               │ /api/v1/*    │
                                               └──────────────┘
```

- **pdca-mcp**: TypeScript製MCPサーバー。Rails APIのHTTPクライアントとして動作
- **通信**: Node.js標準の `fetch` でRails APIに直接HTTPリクエスト
- **トランスポート**: stdio（Claude Code向け）+ Streamable HTTP（Claude Desktop向け）を起動引数で切替
- **認証**: MCPツール経由でログイン → トークンをローカルファイルに保存

## 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | TypeScript |
| ランタイム | Node.js |
| MCPコア | `@modelcontextprotocol/server` |
| トランスポート | `@modelcontextprotocol/node`（stdio, Streamable HTTP） |
| バリデーション | Zod v4 |
| HTTP通信 | Node.js標準 `fetch` |
| ビルド | `tsc` |

## プロジェクト構造

```
pdca-mcp/
├── src/
│   ├── index.ts              # エントリポイント（トランスポート切替）
│   ├── server.ts             # MCPサーバー定義・ツール登録
│   ├── client/
│   │   └── api-client.ts     # Rails API HTTPクライアント
│   ├── auth/
│   │   └── auth-manager.ts   # トークン管理（保存・読込・削除）
│   ├── tools/
│   │   ├── auth.ts           # login, logout, whoami
│   │   ├── reports.ts        # report_create, report_today, etc.
│   │   ├── goals.ts          # goal_create, goal_current, etc.
│   │   ├── plans.ts          # plan_setup, plan_show, etc.
│   │   ├── comments.ts       # comment_list, comment_create, etc.
│   │   ├── students.ts       # student_list, student_show（講師用）
│   │   ├── progress.ts       # progress_list, progress_show（講師用）
│   │   └── dashboard.ts      # dashboard_daily（講師用）
│   └── types/
│       └── api-types.ts      # APIレスポンス型定義
├── package.json
├── tsconfig.json
└── README.md
```

### 設計方針

- `tools/` にリソース単位でファイル分割（1ファイル = 1リソースの全操作）
- `client/` はRails APIとの通信のみ担当、ビジネスロジックは持たない
- `auth/` はトークンの永続化を担当
- `types/` にAPIレスポンスの型を集約

## ツール一覧（24ツール）

### 認証（3ツール）

| ツール名 | 入力 | 説明 |
|---------|------|------|
| `login` | email, password, api_url? | ログインしてトークンを保存 |
| `logout` | — | トークンを削除 |
| `whoami` | — | 現在のユーザー情報を取得 |

### レポート管理（5ツール）

| ツール名 | 入力 | 説明 |
|---------|------|------|
| `report_create` | learning_plan, learning_do?, learning_check?, learning_action?, learning_status?, report_date? | PDCAレポート作成 |
| `report_today` | — | 今日のレポート取得 |
| `report_show` | id or date | 特定レポート取得 |
| `report_list` | month?, page? | レポート一覧（月別・ページング） |
| `report_update` | id, learning_plan?, learning_do?, learning_check?, learning_action?, learning_status? | レポート更新 |

### 週次目標管理（4ツール）

| ツール名 | 入力 | 説明 |
|---------|------|------|
| `goal_create` | items (content + category_id?), week_start_date? | 週次目標作成 |
| `goal_current` | — | 今週の目標取得 |
| `goal_list` | — | 目標一覧 |
| `goal_update` | id, items? | 目標・進捗更新 |

### 学習計画管理（3ツール）

| ツール名 | 入力 | 説明 |
|---------|------|------|
| `plan_setup` | course_name, categories | 学習計画セットアップ |
| `plan_show` | — | 現在の学習計画取得 |
| `plan_add_category` | name, estimated_hours | カテゴリ追加 |

### コメント（3ツール）

| ツール名 | 入力 | 説明 |
|---------|------|------|
| `comment_list` | report_id | レポートへのコメント一覧 |
| `comment_create` | report_id, content | コメント作成 |
| `comment_delete` | id | コメント削除 |

### 講師専用（6ツール）

| ツール名 | 入力 | 説明 |
|---------|------|------|
| `student_list` | team?, status? | 受講生一覧 |
| `student_show` | id | 受講生詳細 |
| `student_reports` | student_id, month?, page? | 受講生のレポート一覧 |
| `progress_list` | — | 進捗一覧 |
| `progress_show` | student_id | 受講生の進捗詳細 |
| `dashboard_daily` | date? | 日次サマリ |

## 認証フロー

### ログイン

```
1. Claude → login(email, password, api_url)
2. pdca-mcp → POST /api/v1/auth/login
3. Rails API → { token, user }
4. pdca-mcp → ~/.pdca-mcp.json に保存
5. Claude ← { success: true, user: { name, role } }
```

### 以降の操作

```
1. Claude → report_today()
2. pdca-mcp → ~/.pdca-mcp.json からトークン読込
   └─ トークンなし → エラー返却（UNAUTHORIZED）
3. pdca-mcp → GET /api/v1/reports/today (Authorization: Bearer <token>)
4. Rails API → { report } or { error }
5. Claude ← 構造化レスポンス
```

### トークン保存形式（~/.pdca-mcp.json）

```json
{
  "api_url": "https://example.com",
  "token": "abc123...",
  "user": {
    "id": 1,
    "name": "田中",
    "role": "student"
  }
}
```

環境変数 `PDCA_API_URL` / `PDCA_TOKEN` によるオーバーライドもサポート。

## エラーハンドリング

### 方針

- 構造化エラーを返し、Claudeが状況に応じて日本語で説明する
- MCP側では人間向けメッセージを組み立てない

### エラーレスポンス構造

```typescript
// 成功
{
  content: [{ type: "text", text: JSON.stringify(data) }]
}

// 失敗
{
  content: [{
    type: "text",
    text: JSON.stringify({
      error: "VALIDATION_ERROR",  // エラーコード
      status: 422,                // HTTPステータス
      details: {                  // API側のエラー詳細
        learning_plan: ["を入力してください"]
      }
    })
  }],
  isError: true
}
```

### エラーコード一覧

| コード | 状況 |
|--------|------|
| `UNAUTHORIZED` | 未ログインまたはトークン無効 |
| `FORBIDDEN` | ロール権限不足（受講生が講師用ツールを使用） |
| `NOT_FOUND` | リソースが見つからない |
| `VALIDATION_ERROR` | 入力バリデーションエラー |
| `NETWORK_ERROR` | APIサーバーに接続できない |
| `SERVER_ERROR` | APIサーバー内部エラー |

## トランスポート

### 起動方式

```bash
# stdio（デフォルト）: Claude Code向け
node dist/index.js

# Streamable HTTP: Claude Desktop向け
node dist/index.js --http --port 3100
```

### Claude Code への登録

```bash
claude mcp add -s user pdca-mcp -- node /path/to/pdca-mcp/dist/index.js
```

### Claude Desktop からの接続

```bash
# サーバー起動
node dist/index.js --http --port 3100

# 接続登録
claude mcp add -t http pdca-mcp http://localhost:3100/mcp
```

### セキュリティ（Streamable HTTP）

- デフォルトで `localhost` のみ受付
- DNS Rebinding保護はMCP SDK（Express統合）が自動処理
- 外部公開は `--host 0.0.0.0` で可能（開発用、非推奨）

## アップデート方式

手動アップデート:

```bash
cd /path/to/pdca-mcp
git pull
npm install
npm run build
# stdio: 次回Claude Code起動時に反映
# HTTP: サーバー再起動が必要
```

自動アップデートは現時点ではスコープ外。必要に応じて後から追加可能。

## スコープ外（将来対応）

- 自動アップデート機能
- CLIの未マージ機能に対応するツール
- npmパブリッシュ
- OAuth認証（現時点はBearer token方式で十分）
