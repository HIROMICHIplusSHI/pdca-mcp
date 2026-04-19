import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthManager } from '../src/auth/auth-manager.js';
import { unlinkSync, existsSync, statSync, chmodSync, writeFileSync } from 'fs';
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

    it('新規作成時にファイル権限 0600 で書き込む', () => {
      authManager.saveConfig({
        api_url: 'https://example.com',
        token: 't',
        user: { id: 1, name: 'n', email: 'e', role: 'student' as const },
      });
      const mode = statSync(testConfigPath).mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('既存の緩い権限ファイルを上書きしても 0600 になる（chmod保証）', () => {
      // 事前に緩い権限でファイルを作っておく
      writeFileSync(testConfigPath, '{}', { encoding: 'utf-8' });
      chmodSync(testConfigPath, 0o644);
      expect(statSync(testConfigPath).mode & 0o777).toBe(0o644);

      authManager.saveConfig({
        api_url: 'https://example.com',
        token: 't',
        user: { id: 1, name: 'n', email: 'e', role: 'student' as const },
      });
      expect(statSync(testConfigPath).mode & 0o777).toBe(0o600);
    });
  });

  describe('キャッシュ', () => {
    it('ファイルが変更されなければ readFileSync は1回しか呼ばれない', () => {
      authManager.saveConfig({
        api_url: 'https://example.com',
        token: 'cached',
        user: { id: 1, name: 'n', email: 'e', role: 'student' as const },
      });
      // saveConfig 時点でキャッシュ投入済み。以降の呼び出しでは readFileSync を叩かない。
      const fs = require('fs');
      const spy = vi.spyOn(fs, 'readFileSync');
      authManager.getToken();
      authManager.getApiUrl();
      authManager.getConfig();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('ファイルが外部で更新されれば再読込される', async () => {
      authManager.saveConfig({
        api_url: 'https://old.example.com',
        token: 'old',
        user: { id: 1, name: 'n', email: 'e', role: 'student' as const },
      });
      expect(authManager.getToken()).toBe('old');

      // mtime を進めるために少し待ってから直接書き換え
      await new Promise((r) => setTimeout(r, 10));
      writeFileSync(testConfigPath, JSON.stringify({
        api_url: 'https://new.example.com',
        token: 'new',
        user: { id: 1, name: 'n', email: 'e', role: 'student' },
      }), { encoding: 'utf-8' });

      expect(authManager.getToken()).toBe('new');
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
    it('tokenは設定がない場合nullを返す', () => {
      expect(authManager.getToken()).toBeNull();
    });

    it('api_urlは設定がない場合ハードコードされた本番URLを返す', () => {
      expect(authManager.getApiUrl()).toBe('https://pdca-app-475677fd481e.herokuapp.com');
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
