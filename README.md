# PDCA MCP Server

PDCA報告アプリ用のMCPサーバー。Claude Code / Claude DesktopからPDCAデータをシームレスに操作できます。

## セットアップ

### 前提条件

- Node.js 22+
- PDCA APIサーバーが稼働していること

### インストール

```bash
git clone <repository-url>
cd pdca-mcp
npm install
npm run build
```

### Claude Code に登録（stdio）

```bash
claude mcp add -s user pdca-mcp -- node /path/to/pdca-mcp/dist/index.js
```

### Claude Desktop に登録（HTTP）

```bash
# サーバー起動
npm run start:http

# 別ターミナルで登録
claude mcp add -t http pdca-mcp http://localhost:3100/mcp
```

## 使い方

Claude Code / Claude Desktop 上で自然言語で操作できます:

- 「PDCAにログインして」→ メールとパスワードを聞かれます
- 「今日のレポートを作成して」
- 「今週の目標を確認して」
- 「田中さんの進捗を見せて」（講師のみ）

## ツール一覧（24ツール）

### 認証
- `login` - ログイン
- `logout` - ログアウト
- `whoami` - 現在のユーザー情報

### レポート
- `report_create` - レポート作成
- `report_today` - 今日のレポート取得
- `report_show` - レポート取得（ID/日付指定）
- `report_list` - レポート一覧
- `report_update` - レポート更新

### 週次目標
- `goal_create` - 目標作成
- `goal_current` - 今週の目標
- `goal_list` - 目標一覧
- `goal_update` - 目標更新

### 学習計画
- `plan_setup` - 計画セットアップ
- `plan_show` - 計画取得
- `plan_add_category` - カテゴリ追加

### コメント
- `comment_list` - コメント一覧
- `comment_create` - コメント作成
- `comment_delete` - コメント削除

### 講師専用
- `student_list` - 受講生一覧
- `student_show` - 受講生詳細
- `student_reports` - 受講生レポート一覧
- `progress_list` - 進捗一覧
- `progress_show` - 進捗詳細
- `dashboard_daily` - 日次ダッシュボード

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `PDCA_API_URL` | API URL（設定ファイルをオーバーライド） |
| `PDCA_TOKEN` | 認証トークン（設定ファイルをオーバーライド） |

## アップデート

```bash
cd /path/to/pdca-mcp
git pull
npm install
npm run build
```

stdio: 次回Claude Code起動時に反映。HTTP: サーバー再起動が必要。

## 開発

```bash
npm run dev       # TypeScript watchモード
npm test          # テスト実行
npm run test:watch # テストwatchモード
```
