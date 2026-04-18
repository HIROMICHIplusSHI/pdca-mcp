import { readFileSync, writeFileSync, unlinkSync, existsSync, chmodSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { AuthConfig } from '../types/api-types.js';

const DEFAULT_CONFIG_PATH = join(homedir(), '.pdca-mcp.json');

export class AuthManager {
  private readonly configPath: string;
  private cache: { config: AuthConfig | null; mtimeMs: number } | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath ?? DEFAULT_CONFIG_PATH;
  }

  getConfig(): AuthConfig | null {
    try {
      if (!existsSync(this.configPath)) {
        this.cache = null;
        return null;
      }
      // mtime が変わっていなければキャッシュを返す（毎回の readFileSync を回避）
      const mtimeMs = statSync(this.configPath).mtimeMs;
      if (this.cache && this.cache.mtimeMs === mtimeMs) {
        return this.cache.config;
      }
      const raw = readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(raw) as AuthConfig;
      this.cache = { config, mtimeMs };
      return config;
    } catch {
      this.cache = null;
      return null;
    }
  }

  saveConfig(config: AuthConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
    // writeFileSync の `mode` は既存ファイル上書き時に適用されないため明示的に権限を再設定
    chmodSync(this.configPath, 0o600);
    this.cache = { config, mtimeMs: statSync(this.configPath).mtimeMs };
  }

  deleteConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        unlinkSync(this.configPath);
      }
    } catch {
      // ファイルが存在しない場合は無視
    }
    this.cache = null;
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
