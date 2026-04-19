# PDCA MCP Server

PDCA報告アプリ用のMCPサーバー。Claude Code / Claude DesktopからPDCAデータをシームレスに操作できます。

## セットアップ

### 前提条件

- Node.js 22+
- PDCA APIサーバーが稼働していること

### インストール

```bash
git clone git@github.com:HIROMICHIplusSHI/pdca-mcp.git
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

## ツール一覧（30ツール）

### 認証（3）
- `login` - ログイン
- `logout` - ログアウト
- `whoami` - 現在のユーザー情報

### レポート（5）
- `report_create` - レポート作成
- `report_today` - 今日のレポート取得
- `report_show` - レポート取得（ID/日付指定）
- `report_list` - レポート一覧
- `report_update` - レポート更新

### 週次目標（4）
- `goal_create` - 目標作成
- `goal_current` - 今週の目標
- `goal_list` - 目標一覧
- `goal_update` - 目標更新

### 学習計画（3）
- `plan_setup` - 計画セットアップ
- `plan_show` - 計画取得
- `plan_add_category` - カテゴリ追加

### 学習時間（2）
- `study_show` - 学習時間取得
- `study_log` - 学習時間記録

### 日次目標（3）
- `daily_show` - 日次目標取得
- `daily_list` - 日次目標一覧
- `daily_update` - 日次目標更新

> **注**: `report_create` / `report_update` で `learning_plan` を指定すると、該当日の日次目標アイテムへ自動反映されます（改行区切りで `items` に position 昇順マッピング）。アプリUI（Rails HTML）はHTMLコントローラ側で `find_or_create_daily_goal` による紐付けが行われるため問題にならないが、API直叩きでは紐付けがなく表示が乖離する。この同期はAPIクライアント側の責務として実装（[koki-kato/pdca-app#90](https://github.com/koki-kato/pdca-app/issues/90) で合意済み・クローズ）。
>
> **同期仕様の詳細**:
> - 末尾改行（`"a\n"` の `\n` 部分）は無視
> - 中間の空行（`"a\n\nc"` の2行目）は空文字として対応する item を上書き
> - 行数 < item数 の場合、余った item は変更せず残す
> - 行数 > item数 の場合、余った行は無視

### コメント（3）
- `comment_list` - コメント一覧
- `comment_create` - コメント作成
- `comment_delete` - コメント削除

### 講師専用（7）
- `student_list` - 受講生一覧
- `student_show` - 受講生詳細
- `student_reports` - 受講生レポート一覧
- `student_report_show` - 受講生レポート詳細
- `progress_list` - 進捗一覧
- `progress_show` - 進捗詳細
- `dashboard_daily` - 日次ダッシュボード

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `PDCA_API_URL` | API URL（設定ファイルをオーバーライド） |
| `PDCA_TOKEN` | 認証トークン（設定ファイルをオーバーライド） |

## セキュリティに関する注意

- 認証トークンは `~/.pdca-mcp.json` に**平文で保存**されます（権限 `0600`）。
- 共有端末では使用しないでください。`logout` ツールで削除可能です。
- 共有端末では、ファイル保存を避けるために環境変数 `PDCA_TOKEN` / `PDCA_API_URL` でトークンを渡す運用を推奨します（設定ファイルより優先されます）。
- トークン漏洩が疑われる場合は、PDCAアプリ側で再ログインして旧トークンを無効化してください。

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
