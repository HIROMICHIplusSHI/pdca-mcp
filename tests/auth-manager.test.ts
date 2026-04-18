import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthManager } from '../src/auth/auth-manager.js';
import { unlinkSync, existsSync } from 'fs';
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
