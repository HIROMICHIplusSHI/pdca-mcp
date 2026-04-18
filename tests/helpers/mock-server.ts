import { vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * registerTool 呼び出しをキャプチャし、名前で handler を取り出せるようにする mock。
 * 各ツールのURL組み立てやバリデーションを単体でテストするために使用する。
 */
export interface CapturedTool {
  config: { title: string; description: string; inputSchema: unknown };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (params: any) => Promise<any>;
}

export interface MockServer {
  server: McpServer;
  tools: Map<string, CapturedTool>;
  getHandler<T = unknown>(name: string): (params: T) => Promise<unknown>;
}

export function createMockServer(): MockServer {
  const tools = new Map<string, CapturedTool>();
  const server = {
    registerTool: vi.fn(
      (
        name: string,
        config: CapturedTool['config'],
        handler: CapturedTool['handler']
      ) => {
        tools.set(name, { config, handler });
      }
    ),
  } as unknown as McpServer;

  return {
    server,
    tools,
    getHandler(name: string) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool not registered: ${name}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return tool.handler as any;
    },
  };
}
