# PDCA MCP Server

PDCA報告アプリ（proaca）用のMCPサーバー。Claude Code / Claude DesktopからPDCAデータをシームレスに操作できます。

> **⚠️ 非公式開発スコープ**
> 本パッケージは `@proaca-dev` スコープで配布される**非公式開発版**です（`-dev` サフィックスは業界慣習で非公式/開発系を示します）。proaca の正式サービスとは独立して個人メンテされており、API互換性やサポートは保証されません。
>
> - **対象**: proaca 受講生・インターンの限定利用
> - **対象外の利用**: サポート外（issue対応不可）
> - **バージョン**: `0.x`（破壊的変更を許容）。`1.0.0` は全展開フェーズで切ります
> - **問題発生時**: [Issues](https://github.com/HIROMICHIplusSHI/pdca-mcp/issues) へ

---

## 受講生向けセットアップ

### 前提条件
- Node.js 20以上
- Claude Code または Claude Desktop

### 1コマンドで導入

```bash
claude mcp add -s user pdca-mcp -- npx -y @proaca-dev/pdca-mcp
```

### 初回ログイン

Claude Code / Desktop 上で「PDCAにログインして」とお願いすると、メールアドレス・パスワードを聞かれます。入力すれば以降は自動で認証されます。

> API URL は proaca 本番URLがパッケージ内にハードコードされています（受講生は意識不要）。開発者がローカル/staging に切り替えたい場合のみ `PDCA_API_URL` 環境変数で上書き可能です（後述）。

### アップデート

通常は作業不要。`npx` 経由で最新バージョンが自動取得されます。

明示的に最新化したい場合:
```bash
npx clear-npx-cache
# または
npx -y @proaca-dev/pdca-mcp@latest
```

---

## 使い方

Claude Code / Claude Desktop 上で自然言語で操作できます:

- 「PDCAにログインして」
- 「今日のレポートを作成して」
- 「今週の目標を確認して」
- 「田中さんの進捗を見せて」（講師のみ）

---

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

### `learning_plan` と日次目標の同期挙動

`report_create` / `report_update` で `learning_plan` を指定すると、該当日の日次目標アイテムへ自動反映されます（改行区切りで `items` に position 昇順マッピング）。アプリUI（Rails HTML）はHTMLコントローラ側で `find_or_create_daily_goal` による紐付けが行われるため表示問題なし、API直叩きでは紐付けがなく表示が乖離する問題への対応として、APIクライアント側の責務として実装（[koki-kato/pdca-app#90](https://github.com/koki-kato/pdca-app/issues/90) で合意済み・クローズ）。

同期仕様:
- 末尾改行（`"a\n"` の `\n` 部分）は無視
- 中間の空行（`"a\n\nc"` の2行目）は空文字として対応する item を上書き
- 行数 < item数 の場合、余った item は変更せず残す
- 行数 > item数 の場合、余った行は無視

### 双方向同期の挙動

- `report_create` / `report_update`: `learning_plan` → `daily_goal_items` へ伝搬
- `goal_update`: `daily_goal_items` → `report.learning_plan` へ逆伝搬（バックエンドが意図せず上書きするのを救済）

**last wins ルール**: 同じ週に対して `report_update` と `goal_update` を連続で叩いた場合、**最後に呼んだツールの入力が勝つ**。通常運用では問題になりませんが、自動化スクリプト等で短時間に両方を叩く場合は実行順序に注意してください。

---

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `PDCA_API_URL` | API URL（設定ファイルをオーバーライド） |
| `PDCA_TOKEN` | 認証トークン（設定ファイルをオーバーライド） |

---

## セキュリティに関する注意

- 認証トークンは `~/.pdca-mcp.json` に**平文で保存**されます（権限 `0600`）
- 共有端末では使用しないでください。`logout` ツールで削除可能です
- 共有端末では、ファイル保存を避けるために環境変数 `PDCA_TOKEN` / `PDCA_API_URL` でトークンを渡す運用を推奨（設定ファイルより優先されます）
- トークン漏洩が疑われる場合は、PDCAアプリ側で再ログインして旧トークンを無効化してください
- **API URL はハードコード**: `login` ツールでは API URL を指定できません（proaca 本番URL固定）。受講生が偽URLを入力してしまう phishing リスクを構造的に排除しています。開発者が別環境で検証する場合のみ `PDCA_API_URL` 環境変数で上書き可能です

---

## 開発者向けセットアップ

ローカルでコードを変更・検証したい場合:

```bash
git clone git@github.com:HIROMICHIplusSHI/pdca-mcp.git
cd pdca-mcp
npm install
npm run build

# ローカルの dist/index.js を指定して登録
claude mcp add -s user pdca-mcp-local -- node /path/to/pdca-mcp/dist/index.js
```

### Claude Desktop (HTTP) で使う場合
```bash
npm run start:http
claude mcp add -t http pdca-mcp http://localhost:3100/mcp
```

### 開発コマンド

```bash
npm run dev        # TypeScript watchモード
npm test           # テスト実行
npm run test:watch # テストwatchモード
```

### ローカル版のアップデート

```bash
cd /path/to/pdca-mcp
git pull
npm install
npm run build
```
stdio: 次回Claude Code起動時に反映。HTTP: サーバー再起動が必要。

---

## メンテナ向け: 新バージョンの公開

```bash
npm version patch  # または minor / major
npm publish
git push --follow-tags
```

`prepublishOnly` でビルド+テストが自動実行されます。
