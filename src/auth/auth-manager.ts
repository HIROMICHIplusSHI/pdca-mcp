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
