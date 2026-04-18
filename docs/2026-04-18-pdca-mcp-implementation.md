# PDCA MCP サーバー実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDCA報告アプリのMCPサーバーを構築し、Claude Code/Desktopからシームレスに操作可能にする

**Architecture:** TypeScript製MCPサーバーがRails API（/api/v1/*）にHTTPリクエストを送信するプロキシ構成。フラットツール方式で24ツールを公開し、認証トークンはローカルファイルに永続化する。

**Tech Stack:** TypeScript, @modelcontextprotocol/server v1.29+, @modelcontextprotocol/node, Zod v4, vitest, Node.js fetch API

**設計書:** `docs/superpowers/specs/2026-04-18-pdca-mcp-design.md`

**注意事項:**
- `student_reports` ツールは `GET /api/v1/instructor/students/:id/reports` を呼び出すが、このエンドポイントはバックエンド側で未実装の可能性がある。実装時にバックエンドのルートを確認し、存在しない場合はバックエンド側の対応後に追加する。
- CLI側に未マージの機能がある。本計画では現在マージ済みのAPIのみを対象とする。

---

## ファイル構成

```
pdca-mcp/
├── src/
│   ├── index.ts              # エントリポイント（トランスポート切替）
│   ├── server.ts             # MCPサーバー定義・全ツール登録
│   ├── client/
│   │   └── api-client.ts     # Rails API HTTPクライアント
│   ├── auth/
│   │   └── auth-manager.ts   # トークン永続化（~/.pdca-mcp.json）
│   ├── tools/
│   │   ├── auth.ts           # login, logout, whoami（3ツール）
│   │   ├── reports.ts        # report_create, report_today, etc.（5ツール）
│   │   ├── goals.ts          # goal_create, goal_current, etc.（4ツール）
│   │   ├── plans.ts          # plan_setup, plan_show, etc.（3ツール）
│   │   ├── comments.ts       # comment_list, comment_create, etc.（3ツール）
│   │   ├── students.ts       # student_list, student_show, student_reports（3ツール）
│   │   ├── progress.ts       # progress_list, progress_show（2ツール）
│   │   └── dashboard.ts      # dashboard_daily（1ツール）
│   ├── types/
│   │   └── api-types.ts      # APIレスポンス型定義
│   └── utils/
│       └── response.ts       # MCP応答フォーマットヘルパー
├── tests/
│   ├── auth-manager.test.ts
│   ├── api-client.test.ts
│   └── tools/
│       └── auth.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

### Task 1: プロジェクトセットアップ

**Files:**
- Create: `pdca-mcp/package.json`
- Create: `pdca-mcp/tsconfig.json`
- Create: `pdca-mcp/vitest.config.ts`
- Create: `pdca-mcp/.gitignore`

- [ ] **Step 1: プロジェクトディレクトリ作成・git初期化**

```bash
mkdir -p ~/Desktop/pdca-mcp
cd ~/Desktop/pdca-mcp
git init
```

- [ ] **Step 2: package.json 作成**

```json
{
  "name": "pdca-mcp",
  "version": "1.0.0",
  "description": "PDCA報告アプリ用MCPサーバー",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "start:http": "node dist/index.js --http --port 3100",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^1.29.0",
    "@modelcontextprotocol/node": "^1.29.0",
    "express": "^5.1.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: tsconfig.json 作成**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: vitest.config.ts 作成**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 5: .gitignore 作成**

```
node_modules/
dist/
*.tsbuildinfo
.env
```

- [ ] **Step 6: 依存インストール・ビルド確認**

```bash
cd ~/Desktop/pdca-mcp
npm install
```

Expected: `node_modules/` が生成される。エラーなし。

- [ ] **Step 7: コミット**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore package-lock.json
git commit -m "chore: プロジェクト初期セットアップ"
```

---

### Task 2: 型定義・ユーティリティ

**Files:**
- Create: `src/types/api-types.ts`
- Create: `src/utils/response.ts`

- [ ] **Step 1: APIレスポンス型定義を作成**

`src/types/api-types.ts`:

```typescript
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'instructor';
}

export interface AuthConfig {
  api_url: string;
  token: string;
  user: User;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Report {
  id: number;
  report_date: string;
  learning_status: 'green' | 'yellow' | 'red';
  learning_plan: string | null;
  learning_do: string | null;
  learning_check: string | null;
  learning_action: string | null;
  curriculum_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportListResponse {
  reports: Report[];
  meta: { total: number };
}

export interface WeeklyGoalItem {
  id: number;
  content: string;
  position: number;
  progress: number;
  category_id: number | null;
  category_name: string | null;
}

export interface WeeklyGoal {
  id: number;
  week_start_date: string;
  week_end_date: string;
  completion_rate: number;
  items: WeeklyGoalItem[];
  created_at: string;
  updated_at: string;
}

export interface PlanCategory {
  id: number;
  name: string;
  estimated_hours: number;
  position: number;
  completed: boolean;
}

export interface Plan {
  course_id: number;
  course_name: string;
  start_date: string;
  target_completion_date: string | null;
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  categories: PlanCategory[];
}

export interface Comment {
  id: number;
  content: string;
  user: { id: number; name: string; role: string };
  created_at: string;
}

export interface AiComment {
  content: string;
  created_at: string;
}

export interface StudentSummary {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  teams: string[];
  latest_report_date: string | null;
  course_names: string[];
}

export interface StudentDetail {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  teams: string[];
  courses: { id: number; name: string; status: string }[];
  latest_report_date: string | null;
  meeting_cycle_start_day: number | null;
}

export interface DashboardStudent {
  id: number;
  name: string;
  teams: string[];
  submitted: boolean;
  report: {
    id: number;
    learning_status: 'green' | 'yellow' | 'red';
    learning_plan: string;
    learning_do: string;
    learning_check: string;
    learning_action: string;
    comment_count: number;
  } | null;
}

export interface DashboardDailyResponse {
  date: string;
  summary: {
    total: number;
    submitted: number;
    not_submitted: number;
    green: number;
    yellow: number;
    red: number;
  };
  students: DashboardStudent[];
}

export interface ProgressStudent {
  id: number;
  name: string;
  teams: string[];
  courses: {
    id: number;
    name: string;
    completion_rate: number;
    completed_categories: number;
    total_categories: number;
  }[];
}

export interface ProgressDetail {
  student: { id: number; name: string };
  courses: {
    id: number;
    name: string;
    completion_rate: number;
    categories: {
      id: number;
      name: string;
      completed: boolean;
      position: number;
    }[];
  }[];
}

export interface ApiErrorResponse {
  error: string;
  status: number;
  details?: Record<string, string[]>;
}
```

- [ ] **Step 2: MCP応答フォーマットヘルパーを作成**

`src/utils/response.ts`:

```typescript
export interface CallToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export function formatSuccess(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

export function formatError(
  code: string,
  status: number,
  details?: Record<string, string[]>
): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: code, status, details }),
      },
    ],
    isError: true,
  };
}
```

- [ ] **Step 3: ビルド確認**

```bash
cd ~/Desktop/pdca-mcp
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/types/api-types.ts src/utils/response.ts
git commit -m "feat: API型定義とMCP応答ヘルパーを追加"
```

---

### Task 3: AuthManager（TDD）

**Files:**
- Create: `tests/auth-manager.test.ts`
- Create: `src/auth/auth-manager.ts`

- [ ] **Step 1: テストを作成**

`tests/auth-manager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../src/auth/auth-manager.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('AuthManager', () => {
  const testConfigPath = join(tmpdir(), '.pdca-mcp-test.json');
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager(testConfigPath);
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('getConfig', () => {
    it('ファイルが存在しない場合nullを返す', () => {
      expect(authManager.getConfig()).toBeNull();
    });

    it('保存済みの設定を読み込める', () => {
      const config = {
        api_url: 'https://example.com',
        token: 'test-token',
        user: { id: 1, name: 'テスト', email: 'test@example.com', role: 'student' as const },
      };
      authManager.saveConfig(config);
      expect(authManager.getConfig()).toEqual(config);
    });
  });

  describe('saveConfig', () => {
    it('設定をファイルに保存する', () => {
      const config = {
        api_url: 'https://example.com',
        token: 'abc123',
        user: { id: 1, name: '田中', email: 'tanaka@example.com', role: 'student' as const },
      };
      authManager.saveConfig(config);
      expect(existsSync(testConfigPath)).toBe(true);
      expect(authManager.getConfig()).toEqual(config);
    });
  });

  describe('deleteConfig', () => {
    it('設定ファイルを削除する', () => {
      const config = {
        api_url: 'https://example.com',
        token: 'abc123',
        user: { id: 1, name: '田中', email: 'tanaka@example.com', role: 'student' as const },
      };
      authManager.saveConfig(config);
      authManager.deleteConfig();
      expect(authManager.getConfig()).toBeNull();
    });

    it('ファイルが存在しなくてもエラーにならない', () => {
      expect(() => authManager.deleteConfig()).not.toThrow();
    });
  });

  describe('getToken / getApiUrl', () => {
    it('設定がない場合nullを返す', () => {
      expect(authManager.getToken()).toBeNull();
      expect(authManager.getApiUrl()).toBeNull();
    });

    it('設定がある場合値を返す', () => {
      authManager.saveConfig({
        api_url: 'https://example.com',
        token: 'my-token',
        user: { id: 1, name: 'テスト', email: 'test@example.com', role: 'instructor' as const },
      });
      expect(authManager.getToken()).toBe('my-token');
      expect(authManager.getApiUrl()).toBe('https://example.com');
    });

    it('環境変数でオーバーライドできる', () => {
      process.env.PDCA_TOKEN = 'env-token';
      process.env.PDCA_API_URL = 'https://env.example.com';
      expect(authManager.getToken()).toBe('env-token');
      expect(authManager.getApiUrl()).toBe('https://env.example.com');
      delete process.env.PDCA_TOKEN;
      delete process.env.PDCA_API_URL;
    });
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
cd ~/Desktop/pdca-mcp
npx vitest run tests/auth-manager.test.ts
```

Expected: FAIL（`auth-manager.ts` が存在しない）

- [ ] **Step 3: AuthManager実装**

`src/auth/auth-manager.ts`:

```typescript
import { readFileSync, writeFileSync, unlinkSync, existsSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { AuthConfig } from '../types/api-types.js';

const DEFAULT_CONFIG_PATH = join(homedir(), '.pdca-mcp.json');

export class AuthManager {
  private readonly configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath ?? DEFAULT_CONFIG_PATH;
  }

  getConfig(): AuthConfig | null {
    try {
      if (!existsSync(this.configPath)) {
        return null;
      }
      const raw = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(raw) as AuthConfig;
    } catch {
      return null;
    }
  }

  saveConfig(config: AuthConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    chmodSync(this.configPath, 0o600);
  }

  deleteConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        unlinkSync(this.configPath);
      }
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  getToken(): string | null {
    const envToken = process.env.PDCA_TOKEN;
    if (envToken) return envToken;
    return this.getConfig()?.token ?? null;
  }

  getApiUrl(): string | null {
    const envUrl = process.env.PDCA_API_URL;
    if (envUrl) return envUrl;
    return this.getConfig()?.api_url ?? null;
  }
}
```

- [ ] **Step 4: テスト実行 → 成功確認**

```bash
npx vitest run tests/auth-manager.test.ts
```

Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add src/auth/auth-manager.ts tests/auth-manager.test.ts
git commit -m "feat: AuthManager（トークン永続化）を実装"
```

---

### Task 4: APIクライアント（TDD）

**Files:**
- Create: `tests/api-client.test.ts`
- Create: `src/client/api-client.ts`

- [ ] **Step 1: テストを作成**

`tests/api-client.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient, ApiError } from '../src/client/api-client.js';
import { AuthManager } from '../src/auth/auth-manager.js';

describe('ApiClient', () => {
  let authManager: AuthManager;
  let apiClient: ApiClient;

  beforeEach(() => {
    authManager = {
      getToken: vi.fn().mockReturnValue('test-token'),
      getApiUrl: vi.fn().mockReturnValue('https://example.com'),
      getConfig: vi.fn(),
      saveConfig: vi.fn(),
      deleteConfig: vi.fn(),
    } as unknown as AuthManager;
    apiClient = new ApiClient(authManager);
    vi.restoreAllMocks();
  });

  describe('request', () => {
    it('正しいURLとヘッダーでリクエストを送信する', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ user: { id: 1 } }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await apiClient.get('/api/v1/auth/me');

      expect(fetch).toHaveBeenCalledWith('https://example.com/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: undefined,
      });
      expect(result).toEqual({ user: { id: 1 } });
    });

    it('トークンなしでもリクエストできる（login用）', async () => {
      (authManager.getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ token: 'new-token' }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await apiClient.post('/api/v1/auth/login', {
        email: 'test@example.com',
        password: 'pass',
      });

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
      expect(result).toEqual({ token: 'new-token' });
    });

    it('POSTリクエストでbodyを送信する', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue({ report: { id: 1 } }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await apiClient.post('/api/v1/reports', {
        report: { learning_plan: 'テスト' },
      });

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBe(
        JSON.stringify({ report: { learning_plan: 'テスト' } })
      );
    });

    it('APIエラー時にApiErrorをthrowする', async () => {
      const mockResponse = {
        ok: false,
        status: 422,
        json: vi
          .fn()
          .mockResolvedValue({ errors: { learning_plan: ['を入力してください'] } }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await expect(apiClient.post('/api/v1/reports', {})).rejects.toThrow(ApiError);

      try {
        await apiClient.post('/api/v1/reports', {});
      } catch (e) {
        const err = e as ApiError;
        expect(err.status).toBe(422);
        expect(err.code).toBe('VALIDATION_ERROR');
      }
    });

    it('ネットワークエラー時にApiErrorをthrowする', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('fetch failed'))
      );

      await expect(apiClient.get('/api/v1/auth/me')).rejects.toThrow(ApiError);

      try {
        await apiClient.get('/api/v1/auth/me');
      } catch (e) {
        const err = e as ApiError;
        expect(err.code).toBe('NETWORK_ERROR');
      }
    });

    it('API URLが未設定の場合エラーをthrowする', async () => {
      (authManager.getApiUrl as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await expect(apiClient.get('/api/v1/auth/me')).rejects.toThrow(ApiError);

      try {
        await apiClient.get('/api/v1/auth/me');
      } catch (e) {
        const err = e as ApiError;
        expect(err.code).toBe('UNAUTHORIZED');
      }
    });

    it('204 No Content の場合はnullを返す', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        json: vi.fn(),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await apiClient.delete('/api/v1/comments/1');
      expect(result).toBeNull();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
npx vitest run tests/api-client.test.ts
```

Expected: FAIL（`api-client.ts` が存在しない）

- [ ] **Step 3: APIクライアント実装**

`src/client/api-client.ts`:

```typescript
import type { AuthManager } from '../auth/auth-manager.js';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, string[]>
  ) {
    super(`API Error: ${code} (${status})`);
    this.name = 'ApiError';
  }
}

function classifyError(status: number): string {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 422) return 'VALIDATION_ERROR';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN_ERROR';
}

export class ApiClient {
  constructor(private readonly authManager: AuthManager) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T | null> {
    const apiUrl = this.authManager.getApiUrl();
    if (!apiUrl) {
      throw new ApiError('UNAUTHORIZED', 401);
    }

    const token = this.authManager.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${apiUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError('NETWORK_ERROR', 0);
    }

    if (response.status === 204) {
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      const code = classifyError(response.status);
      const details = data.errors as Record<string, string[]> | undefined;
      throw new ApiError(code, response.status, details);
    }

    return data as T;
  }

  async get<T>(path: string): Promise<T | null> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T | null> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body: unknown): Promise<T | null> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<T | null> {
    return this.request<T>('DELETE', path);
  }
}
```

- [ ] **Step 4: テスト実行 → 成功確認**

```bash
npx vitest run tests/api-client.test.ts
```

Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add src/client/api-client.ts tests/api-client.test.ts
git commit -m "feat: APIクライアント（HTTP通信・エラーハンドリング）を実装"
```

---

### Task 5: 認証ツール（TDD）

**Files:**
- Create: `src/tools/auth.ts`
- Create: `tests/tools/auth.test.ts`

- [ ] **Step 1: テストを作成**

`tests/tools/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loginHandler, logoutHandler, whoamiHandler } from '../src/tools/auth.js';
import type { ApiClient } from '../src/client/api-client.js';
import type { AuthManager } from '../src/auth/auth-manager.js';
import { ApiError } from '../src/client/api-client.js';

describe('Auth Tools', () => {
  let apiClient: ApiClient;
  let authManager: AuthManager;

  beforeEach(() => {
    apiClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as ApiClient;
    authManager = {
      getToken: vi.fn(),
      getApiUrl: vi.fn(),
      getConfig: vi.fn(),
      saveConfig: vi.fn(),
      deleteConfig: vi.fn(),
    } as unknown as AuthManager;
  });

  describe('loginHandler', () => {
    it('ログイン成功時にトークンを保存して結果を返す', async () => {
      const loginResponse = {
        token: 'new-token',
        user: { id: 1, name: '田中', email: 'tanaka@example.com', role: 'student' },
      };
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue(loginResponse);

      const handler = loginHandler(apiClient, authManager);
      const result = await handler({
        email: 'tanaka@example.com',
        password: 'pass123',
        api_url: 'https://example.com',
      });

      expect(authManager.saveConfig).toHaveBeenCalledWith({
        api_url: 'https://example.com',
        token: 'new-token',
        user: loginResponse.user,
      });
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.user.name).toBe('田中');
    });

    it('ログイン失敗時にエラーを返す', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError('UNAUTHORIZED', 401)
      );

      const handler = loginHandler(apiClient, authManager);
      const result = await handler({
        email: 'wrong@example.com',
        password: 'wrong',
        api_url: 'https://example.com',
      });

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe('UNAUTHORIZED');
    });
  });

  describe('logoutHandler', () => {
    it('設定ファイルを削除してメッセージを返す', async () => {
      const handler = logoutHandler(authManager);
      const result = await handler({});

      expect(authManager.deleteConfig).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
    });
  });

  describe('whoamiHandler', () => {
    it('ユーザー情報を返す', async () => {
      const userResponse = {
        user: { id: 1, name: '田中', email: 'tanaka@example.com', role: 'student' },
      };
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(userResponse);

      const handler = whoamiHandler(apiClient);
      const result = await handler({});

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.user.name).toBe('田中');
    });
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
npx vitest run tests/tools/auth.test.ts
```

Expected: FAIL（`tools/auth.ts` が存在しない）

- [ ] **Step 3: 認証ツール実装**

`src/tools/auth.ts`:

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { AuthManager } from '../auth/auth-manager.js';
import type { LoginResponse } from '../types/api-types.js';
import { formatSuccess, formatError, type CallToolResult } from '../utils/response.js';

export function loginHandler(
  apiClient: ApiClient,
  authManager: AuthManager
): (params: { email: string; password: string; api_url?: string }) => Promise<CallToolResult> {
  return async ({ email, password, api_url }) => {
    try {
      // login時は一時的にAPI URLを設定するため、直接fetchする
      const targetUrl = api_url ?? authManager.getApiUrl() ?? '';
      if (!targetUrl) {
        return formatError('UNAUTHORIZED', 401, {
          api_url: ['API URLを指定してください'],
        });
      }

      const response = await fetch(`${targetUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        return formatError(
          response.status === 401 ? 'UNAUTHORIZED' : 'SERVER_ERROR',
          response.status,
          data.errors
        );
      }

      const data = (await response.json()) as LoginResponse;
      authManager.saveConfig({
        api_url: targetUrl,
        token: data.token,
        user: data.user,
      });

      return formatSuccess({ message: 'ログイン成功', user: data.user });
    } catch (e) {
      if (e instanceof ApiError) {
        return formatError(e.code, e.status, e.details);
      }
      return formatError('NETWORK_ERROR', 0);
    }
  };
}

export function logoutHandler(
  authManager: AuthManager
): (params: Record<string, never>) => Promise<CallToolResult> {
  return async () => {
    authManager.deleteConfig();
    return formatSuccess({ message: 'ログアウトしました' });
  };
}

export function whoamiHandler(
  apiClient: ApiClient
): (params: Record<string, never>) => Promise<CallToolResult> {
  return async () => {
    try {
      const data = await apiClient.get<{ user: LoginResponse['user'] }>('/api/v1/auth/me');
      return formatSuccess(data);
    } catch (e) {
      if (e instanceof ApiError) {
        return formatError(e.code, e.status, e.details);
      }
      return formatError('NETWORK_ERROR', 0);
    }
  };
}

export function registerAuthTools(
  server: McpServer,
  apiClient: ApiClient,
  authManager: AuthManager
): void {
  server.registerTool(
    'login',
    {
      title: 'ログイン',
      description: 'PDCAアプリにログインしてトークンを保存する',
      inputSchema: z.object({
        email: z.string().describe('メールアドレス'),
        password: z.string().describe('パスワード'),
        api_url: z.string().optional().describe('API URL（初回ログイン時は必須）'),
      }),
    },
    loginHandler(apiClient, authManager)
  );

  server.registerTool(
    'logout',
    {
      title: 'ログアウト',
      description: '保存済みの認証トークンを削除する',
      inputSchema: z.object({}),
    },
    logoutHandler(authManager)
  );

  server.registerTool(
    'whoami',
    {
      title: '現在のユーザー',
      description: '現在ログイン中のユーザー情報を取得する',
      inputSchema: z.object({}),
    },
    whoamiHandler(apiClient)
  );
}
```

- [ ] **Step 4: テスト実行 → 成功確認**

```bash
npx vitest run tests/tools/auth.test.ts
```

Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add src/tools/auth.ts tests/tools/auth.test.ts
git commit -m "feat: 認証ツール（login, logout, whoami）を実装"
```

---

### Task 6: レポートツール

**Files:**
- Create: `src/tools/reports.ts`

- [ ] **Step 1: レポートツール実装**

`src/tools/reports.ts`:

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { Report, ReportListResponse } from '../types/api-types.js';
import { formatSuccess, formatError, type CallToolResult } from '../utils/response.js';

async function handleApiCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return formatSuccess(data);
  } catch (e) {
    if (e instanceof ApiError) {
      return formatError(e.code, e.status, e.details);
    }
    return formatError('NETWORK_ERROR', 0);
  }
}

export function registerReportTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'report_create',
    {
      title: 'レポート作成',
      description: 'PDCAレポートを新規作成する',
      inputSchema: z.object({
        learning_plan: z.string().describe('Plan: 学習計画'),
        learning_do: z.string().optional().describe('Do: 実施内容'),
        learning_check: z.string().optional().describe('Check: 振り返り'),
        learning_action: z.string().optional().describe('Action: 改善策'),
        learning_status: z
          .enum(['green', 'yellow', 'red'])
          .optional()
          .describe('学習状況（green/yellow/red）'),
        report_date: z.string().optional().describe('報告日（YYYY-MM-DD形式、省略時は今日）'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.post<{ report: Report }>('/api/v1/reports', { report: params })
      );
    }
  );

  server.registerTool(
    'report_today',
    {
      title: '今日のレポート',
      description: '今日のPDCAレポートを取得する',
      inputSchema: z.object({}),
    },
    async () => {
      return handleApiCall(() =>
        apiClient.get<{ report: Report | null }>('/api/v1/reports/today')
      );
    }
  );

  server.registerTool(
    'report_show',
    {
      title: 'レポート取得',
      description: 'IDまたは日付で特定のレポートを取得する',
      inputSchema: z.object({
        id: z.number().optional().describe('レポートID'),
        date: z.string().optional().describe('日付（YYYY-MM-DD形式）'),
      }),
    },
    async (params) => {
      if (params.id) {
        return handleApiCall(() =>
          apiClient.get<{ report: Report }>(`/api/v1/reports/${params.id}`)
        );
      }
      if (params.date) {
        return handleApiCall(() =>
          apiClient.get<{ report: Report | null }>(
            `/api/v1/reports/by_date?date=${params.date}`
          )
        );
      }
      return formatError('VALIDATION_ERROR', 422, {
        params: ['idまたはdateのいずれかを指定してください'],
      });
    }
  );

  server.registerTool(
    'report_list',
    {
      title: 'レポート一覧',
      description: 'PDCAレポートの一覧を取得する',
      inputSchema: z.object({
        month: z.string().optional().describe('月フィルタ（YYYY-MM形式）'),
        limit: z.number().optional().describe('取得件数（1-100、デフォルト30）'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.month) queryParams.set('month', params.month);
      if (params.limit) queryParams.set('limit', String(params.limit));
      const query = queryParams.toString();
      const path = `/api/v1/reports${query ? `?${query}` : ''}`;
      return handleApiCall(() => apiClient.get<ReportListResponse>(path));
    }
  );

  server.registerTool(
    'report_update',
    {
      title: 'レポート更新',
      description: '既存のPDCAレポートを更新する',
      inputSchema: z.object({
        id: z.number().describe('レポートID'),
        learning_plan: z.string().optional().describe('Plan: 学習計画'),
        learning_do: z.string().optional().describe('Do: 実施内容'),
        learning_check: z.string().optional().describe('Check: 振り返り'),
        learning_action: z.string().optional().describe('Action: 改善策'),
        learning_status: z
          .enum(['green', 'yellow', 'red'])
          .optional()
          .describe('学習状況（green/yellow/red）'),
      }),
    },
    async (params) => {
      const { id, ...reportFields } = params;
      return handleApiCall(() =>
        apiClient.patch<{ report: Report }>(`/api/v1/reports/${id}`, {
          report: reportFields,
        })
      );
    }
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/tools/reports.ts
git commit -m "feat: レポートツール（5ツール）を実装"
```

---

### Task 7: 週次目標ツール

**Files:**
- Create: `src/tools/goals.ts`

- [ ] **Step 1: 週次目標ツール実装**

`src/tools/goals.ts`:

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { WeeklyGoal } from '../types/api-types.js';
import { formatSuccess, formatError, type CallToolResult } from '../utils/response.js';

async function handleApiCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return formatSuccess(data);
  } catch (e) {
    if (e instanceof ApiError) {
      return formatError(e.code, e.status, e.details);
    }
    return formatError('NETWORK_ERROR', 0);
  }
}

export function registerGoalTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'goal_create',
    {
      title: '週次目標作成',
      description: '新しい週次目標を作成する',
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              content: z.string().describe('目標の内容'),
              category_id: z.number().optional().describe('カテゴリID（学習計画から）'),
            })
          )
          .describe('目標項目リスト（最大10件）'),
        week_start: z.string().optional().describe('週の開始日（YYYY-MM-DD形式）'),
        force: z.boolean().optional().describe('既存の目標を上書きするか（デフォルト: false）'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.post<{ weekly_goal: WeeklyGoal }>('/api/v1/weekly_goals', params)
      );
    }
  );

  server.registerTool(
    'goal_current',
    {
      title: '今週の目標',
      description: '今週の週次目標を取得する',
      inputSchema: z.object({}),
    },
    async () => {
      return handleApiCall(() =>
        apiClient.get<{ weekly_goal: WeeklyGoal | null }>('/api/v1/weekly_goals/current')
      );
    }
  );

  server.registerTool(
    'goal_list',
    {
      title: '目標一覧',
      description: '週次目標の一覧を取得する',
      inputSchema: z.object({
        limit: z.number().optional().describe('取得件数（1-50、デフォルト10）'),
      }),
    },
    async (params) => {
      const query = params.limit ? `?limit=${params.limit}` : '';
      return handleApiCall(() =>
        apiClient.get<{ weekly_goals: WeeklyGoal[] }>(`/api/v1/weekly_goals${query}`)
      );
    }
  );

  server.registerTool(
    'goal_update',
    {
      title: '目標更新',
      description: '週次目標のアイテムを更新する（内容や進捗率）',
      inputSchema: z.object({
        id: z.number().describe('週次目標ID'),
        items: z
          .array(
            z.object({
              id: z.number().describe('アイテムID'),
              content: z.string().optional().describe('更新後の内容'),
              progress: z.number().optional().describe('進捗率（0-100）'),
            })
          )
          .describe('更新するアイテム'),
      }),
    },
    async (params) => {
      const { id, items } = params;
      return handleApiCall(() =>
        apiClient.patch<{ weekly_goal: WeeklyGoal }>(`/api/v1/weekly_goals/${id}`, {
          items,
        })
      );
    }
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/tools/goals.ts
git commit -m "feat: 週次目標ツール（4ツール）を実装"
```

---

### Task 8: 学習計画ツール

**Files:**
- Create: `src/tools/plans.ts`

- [ ] **Step 1: 学習計画ツール実装**

`src/tools/plans.ts`:

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { Plan, PlanCategory } from '../types/api-types.js';
import { formatSuccess, formatError, type CallToolResult } from '../utils/response.js';

async function handleApiCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return formatSuccess(data);
  } catch (e) {
    if (e instanceof ApiError) {
      return formatError(e.code, e.status, e.details);
    }
    return formatError('NETWORK_ERROR', 0);
  }
}

export function registerPlanTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'plan_setup',
    {
      title: '学習計画セットアップ',
      description: '新しい学習計画を作成する（カテゴリと見積もり時間を設定）',
      inputSchema: z.object({
        course_name: z.string().optional().describe('コース名'),
        categories: z
          .array(
            z.object({
              name: z.string().describe('カテゴリ名'),
              estimated_hours: z.number().describe('見積もり時間'),
            })
          )
          .describe('学習カテゴリ'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.post<{ plan: Plan }>('/api/v1/plan/setup', params)
      );
    }
  );

  server.registerTool(
    'plan_show',
    {
      title: '学習計画取得',
      description: '現在の学習計画とカテゴリ進捗を取得する',
      inputSchema: z.object({}),
    },
    async () => {
      return handleApiCall(() =>
        apiClient.get<{ plan: Plan | null }>('/api/v1/plan')
      );
    }
  );

  server.registerTool(
    'plan_add_category',
    {
      title: 'カテゴリ追加',
      description: '学習計画にカテゴリを追加する',
      inputSchema: z.object({
        name: z.string().describe('カテゴリ名'),
        estimated_hours: z.number().describe('見積もり時間'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.post<{ category: PlanCategory; plan: Plan }>(
          '/api/v1/plan/categories',
          params
        )
      );
    }
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/tools/plans.ts
git commit -m "feat: 学習計画ツール（3ツール）を実装"
```

---

### Task 9: コメントツール

**Files:**
- Create: `src/tools/comments.ts`

- [ ] **Step 1: コメントツール実装**

`src/tools/comments.ts`:

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { Comment, AiComment } from '../types/api-types.js';
import { formatSuccess, formatError, type CallToolResult } from '../utils/response.js';

async function handleApiCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return formatSuccess(data);
  } catch (e) {
    if (e instanceof ApiError) {
      return formatError(e.code, e.status, e.details);
    }
    return formatError('NETWORK_ERROR', 0);
  }
}

export function registerCommentTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'comment_list',
    {
      title: 'コメント一覧',
      description: '指定レポートへのコメント一覧を取得する',
      inputSchema: z.object({
        report_id: z.number().describe('レポートID'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.get<{ comments: Comment[]; ai_comment: AiComment | null }>(
          `/api/v1/comments?report_id=${params.report_id}`
        )
      );
    }
  );

  server.registerTool(
    'comment_create',
    {
      title: 'コメント作成',
      description: 'レポートにコメントを追加する',
      inputSchema: z.object({
        report_id: z.number().describe('レポートID'),
        content: z.string().describe('コメント内容'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.post<{ comment: Comment }>('/api/v1/comments', params)
      );
    }
  );

  server.registerTool(
    'comment_delete',
    {
      title: 'コメント削除',
      description: 'コメントを削除する',
      inputSchema: z.object({
        id: z.number().describe('コメントID'),
      }),
    },
    async (params) => {
      return handleApiCall(() => apiClient.delete(`/api/v1/comments/${params.id}`));
    }
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/tools/comments.ts
git commit -m "feat: コメントツール（3ツール）を実装"
```

---

### Task 10: 講師用ツール

**Files:**
- Create: `src/tools/students.ts`
- Create: `src/tools/progress.ts`
- Create: `src/tools/dashboard.ts`

- [ ] **Step 1: 受講生管理ツール実装**

`src/tools/students.ts`:

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { StudentSummary, StudentDetail, ReportListResponse } from '../types/api-types.js';
import { formatSuccess, formatError, type CallToolResult } from '../utils/response.js';

async function handleApiCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return formatSuccess(data);
  } catch (e) {
    if (e instanceof ApiError) {
      return formatError(e.code, e.status, e.details);
    }
    return formatError('NETWORK_ERROR', 0);
  }
}

export function registerStudentTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'student_list',
    {
      title: '受講生一覧',
      description: '受講生の一覧を取得する（講師専用）',
      inputSchema: z.object({
        status: z
          .enum(['active', 'inactive'])
          .optional()
          .describe('ステータスフィルタ（デフォルト: active）'),
        team_id: z.number().optional().describe('チームIDフィルタ'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.status) queryParams.set('status', params.status);
      if (params.team_id) queryParams.set('team_id', String(params.team_id));
      const query = queryParams.toString();
      const path = `/api/v1/instructor/students${query ? `?${query}` : ''}`;
      return handleApiCall(() =>
        apiClient.get<{ students: StudentSummary[]; total: number }>(path)
      );
    }
  );

  server.registerTool(
    'student_show',
    {
      title: '受講生詳細',
      description: '受講生の詳細情報を取得する（講師専用）',
      inputSchema: z.object({
        id: z.number().describe('受講生ID'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.get<{ student: StudentDetail }>(
          `/api/v1/instructor/students/${params.id}`
        )
      );
    }
  );

  server.registerTool(
    'student_reports',
    {
      title: '受講生レポート一覧',
      description: '特定の受講生のレポート一覧を取得する（講師専用）。※バックエンドにエンドポイントが存在しない場合はエラーになります。',
      inputSchema: z.object({
        student_id: z.number().describe('受講生ID'),
        month: z.string().optional().describe('月フィルタ（YYYY-MM形式）'),
        limit: z.number().optional().describe('取得件数'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.month) queryParams.set('month', params.month);
      if (params.limit) queryParams.set('limit', String(params.limit));
      const query = queryParams.toString();
      const path = `/api/v1/instructor/students/${params.student_id}/reports${query ? `?${query}` : ''}`;
      return handleApiCall(() => apiClient.get<ReportListResponse>(path));
    }
  );
}
```

- [ ] **Step 2: 進捗ツール実装**

`src/tools/progress.ts`:

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { ProgressStudent, ProgressDetail } from '../types/api-types.js';
import { formatSuccess, formatError, type CallToolResult } from '../utils/response.js';

async function handleApiCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return formatSuccess(data);
  } catch (e) {
    if (e instanceof ApiError) {
      return formatError(e.code, e.status, e.details);
    }
    return formatError('NETWORK_ERROR', 0);
  }
}

export function registerProgressTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'progress_list',
    {
      title: '進捗一覧',
      description: '受講生の進捗一覧を取得する（講師専用）',
      inputSchema: z.object({
        team_id: z.number().optional().describe('チームIDフィルタ'),
      }),
    },
    async (params) => {
      const query = params.team_id ? `?team_id=${params.team_id}` : '';
      return handleApiCall(() =>
        apiClient.get<{ students: ProgressStudent[] }>(
          `/api/v1/instructor/progress${query}`
        )
      );
    }
  );

  server.registerTool(
    'progress_show',
    {
      title: '進捗詳細',
      description: '受講生の詳細な進捗情報を取得する（講師専用）',
      inputSchema: z.object({
        student_id: z.number().describe('受講生ID'),
      }),
    },
    async (params) => {
      return handleApiCall(() =>
        apiClient.get<ProgressDetail>(
          `/api/v1/instructor/progress/${params.student_id}`
        )
      );
    }
  );
}
```

- [ ] **Step 3: ダッシュボードツール実装**

`src/tools/dashboard.ts`:

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { ApiClient } from '../client/api-client.js';
import { ApiError } from '../client/api-client.js';
import type { DashboardDailyResponse } from '../types/api-types.js';
import { formatSuccess, formatError, type CallToolResult } from '../utils/response.js';

async function handleApiCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return formatSuccess(data);
  } catch (e) {
    if (e instanceof ApiError) {
      return formatError(e.code, e.status, e.details);
    }
    return formatError('NETWORK_ERROR', 0);
  }
}

export function registerDashboardTools(server: McpServer, apiClient: ApiClient): void {
  server.registerTool(
    'dashboard_daily',
    {
      title: '日次ダッシュボード',
      description: '日次の報告サマリと受講生一覧を取得する（講師専用）',
      inputSchema: z.object({
        date: z.string().optional().describe('日付（YYYY-MM-DD形式、デフォルト: 昨日）'),
        team_id: z.number().optional().describe('チームIDフィルタ'),
        status: z
          .enum(['green', 'yellow', 'red', 'not_submitted'])
          .optional()
          .describe('ステータスフィルタ'),
      }),
    },
    async (params) => {
      const queryParams = new URLSearchParams();
      if (params.date) queryParams.set('date', params.date);
      if (params.team_id) queryParams.set('team_id', String(params.team_id));
      if (params.status) queryParams.set('status', params.status);
      const query = queryParams.toString();
      const path = `/api/v1/instructor/dashboard/daily${query ? `?${query}` : ''}`;
      return handleApiCall(() => apiClient.get<DashboardDailyResponse>(path));
    }
  );
}
```

- [ ] **Step 4: ビルド確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/tools/students.ts src/tools/progress.ts src/tools/dashboard.ts
git commit -m "feat: 講師用ツール（受講生管理・進捗・ダッシュボード、6ツール）を実装"
```

---

### Task 11: MCPサーバーセットアップ・エントリポイント

**Files:**
- Create: `src/server.ts`
- Create: `src/index.ts`

- [ ] **Step 1: MCPサーバー定義（ツール登録）**

`src/server.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/server';
import { AuthManager } from './auth/auth-manager.js';
import { ApiClient } from './client/api-client.js';
import { registerAuthTools } from './tools/auth.js';
import { registerReportTools } from './tools/reports.js';
import { registerGoalTools } from './tools/goals.js';
import { registerPlanTools } from './tools/plans.js';
import { registerCommentTools } from './tools/comments.js';
import { registerStudentTools } from './tools/students.js';
import { registerProgressTools } from './tools/progress.js';
import { registerDashboardTools } from './tools/dashboard.js';

export function createServer(): {
  server: McpServer;
  authManager: AuthManager;
  apiClient: ApiClient;
} {
  const server = new McpServer({
    name: 'pdca-mcp',
    version: '1.0.0',
  });

  const authManager = new AuthManager();
  const apiClient = new ApiClient(authManager);

  registerAuthTools(server, apiClient, authManager);
  registerReportTools(server, apiClient);
  registerGoalTools(server, apiClient);
  registerPlanTools(server, apiClient);
  registerCommentTools(server, apiClient);
  registerStudentTools(server, apiClient);
  registerProgressTools(server, apiClient);
  registerDashboardTools(server, apiClient);

  return { server, authManager, apiClient };
}
```

- [ ] **Step 2: エントリポイント（トランスポート切替）**

`src/index.ts`:

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/node';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isHttp = args.includes('--http');

  const { server } = createServer();

  if (isHttp) {
    const portIndex = args.indexOf('--port');
    const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 3100;
    const hostIndex = args.indexOf('--host');
    const host = hostIndex !== -1 ? args[hostIndex + 1] : 'localhost';

    // Streamable HTTP トランスポート（Express統合）
    // SDK v1.29+ の createMcpExpressApp または手動セットアップ
    // 実装時にSDKの最新APIを確認して適切な方法を選択する
    const { default: express } = await import('express');
    const { NodeStreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/node'
    );
    const { randomUUID } = await import('crypto');

    const app = express();
    app.use(express.json());

    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    app.post('/mcp', async (req, res) => {
      await transport.handleRequest(req, res);
    });

    app.get('/mcp', async (req, res) => {
      await transport.handleRequest(req, res);
    });

    await server.connect(transport);

    app.listen(port, host, () => {
      console.error(`PDCA MCP Server (HTTP) listening on http://${host}:${port}/mcp`);
    });
  } else {
    // stdio トランスポート
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('PDCA MCP Server (stdio) started');
  }
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

- [ ] **Step 3: ビルド確認**

```bash
cd ~/Desktop/pdca-mcp
npx tsc
```

Expected: `dist/` にコンパイル済みファイルが生成される。エラーなし。

- [ ] **Step 4: コミット**

```bash
git add src/server.ts src/index.ts
git commit -m "feat: MCPサーバーセットアップとエントリポイントを実装"
```

---

### Task 12: README・動作確認

**Files:**
- Create: `README.md`

- [ ] **Step 1: README作成**

`README.md`:

```markdown
# PDCA MCP Server

PDCA報告アプリ用のMCPサーバー。Claude Code / Claude DesktopからPDCAデータをシームレスに操作できます。

## セットアップ

### 前提条件

- Node.js 22+
- PDCA APIサーバーが稼働していること

### インストール

\`\`\`bash
git clone <repository-url>
cd pdca-mcp
npm install
npm run build
\`\`\`

### Claude Code に登録（stdio）

\`\`\`bash
claude mcp add -s user pdca-mcp -- node /path/to/pdca-mcp/dist/index.js
\`\`\`

### Claude Desktop に登録（HTTP）

\`\`\`bash
# サーバー起動
npm run start:http

# 別ターミナルで登録
claude mcp add -t http pdca-mcp http://localhost:3100/mcp
\`\`\`

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

\`\`\`bash
cd /path/to/pdca-mcp
git pull
npm install
npm run build
\`\`\`

stdio: 次回Claude Code起動時に反映。HTTP: サーバー再起動が必要。

## 開発

\`\`\`bash
npm run dev       # TypeScript watchモード
npm test          # テスト実行
npm run test:watch # テストwatchモード
\`\`\`
```

- [ ] **Step 2: 全テスト実行**

```bash
cd ~/Desktop/pdca-mcp
npx vitest run
```

Expected: 全テストPASS

- [ ] **Step 3: stdioモードで起動確認**

```bash
cd ~/Desktop/pdca-mcp
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js 2>/dev/null | head -1
```

Expected: JSON-RPCレスポンス（`{"jsonrpc":"2.0","id":1,"result":{...}}`）が返る

- [ ] **Step 4: コミット**

```bash
git add README.md
git commit -m "docs: READMEを追加"
```

- [ ] **Step 5: Claude Code にMCPを登録して動作確認**

```bash
claude mcp add -s user pdca-mcp -- node ~/Desktop/pdca-mcp/dist/index.js
```

Claude Code を再起動し、以下を試す:
- 「PDCAにログインして」→ email/password入力 → ログイン成功
- 「whoami」→ ユーザー情報表示
- 「今日のレポートを確認して」→ レポート取得

---

## セルフレビュー結果

### 仕様カバレッジ確認

| 設計書の要件 | 対応タスク |
|------------|----------|
| 認証（login, logout, whoami） | Task 5 |
| レポート管理（5ツール） | Task 6 |
| 週次目標管理（4ツール） | Task 7 |
| 学習計画管理（3ツール） | Task 8 |
| コメント（3ツール） | Task 9 |
| 講師用（6ツール） | Task 10 |
| stdio + Streamable HTTP | Task 11 |
| トークン永続化 | Task 3 |
| 構造化エラー | Task 2（ヘルパー）+ Task 4（ApiError） |
| 環境変数オーバーライド | Task 3（AuthManager） |
| README | Task 12 |

全要件カバー済み。

### プレースホルダー確認

なし。全ステップにコードまたはコマンドが記載済み。

### 型・命名の一貫性確認

- `handleApiCall` — Task 6-10 で同一パターン（各ファイルにローカル定義）
- `ApiClient` のメソッド（get/post/patch/delete）— 全ツールで一貫使用
- `formatSuccess` / `formatError` — 全ツールで一貫使用
- `AuthManager` — Task 3定義、Task 4-5で参照、一致
