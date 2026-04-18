import { createServer } from './server.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isHttp = args.includes('--http');

  if (isHttp) {
    const portIndex = args.indexOf('--port');
    const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 3100;
    const hostIndex = args.indexOf('--host');
    const host = hostIndex !== -1 ? args[hostIndex + 1] : 'localhost';

    const { default: express } = await import('express');
    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    );
    const { randomUUID } = await import('crypto');
    const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');

    const app = express();
    app.use(express.json());

    // MCP SDK 推奨パターン: session-id ヘッダ単位で transport を分離し、
    // 複数クライアント同時接続時のセッション混在を防ぐ。
    type SdkTransport = InstanceType<typeof StreamableHTTPServerTransport>;
    const transports: Record<string, SdkTransport> = {};

    const handleMcp = async (
      req: import('express').Request,
      res: import('express').Response
    ): Promise<void> => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: SdkTransport | undefined = sessionId ? transports[sessionId] : undefined;

      if (!transport) {
        // 新規セッション: initialize リクエストのときだけ作成
        if (req.method !== 'POST' || !isInitializeRequest(req.body)) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: valid session required' },
            id: null,
          });
          return;
        }

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id: string) => {
            transports[id] = transport as SdkTransport;
          },
        });

        transport.onclose = (): void => {
          if (transport?.sessionId) {
            delete transports[transport.sessionId];
          }
        };

        const { server } = createServer();
        await server.connect(transport);
      }

      await transport.handleRequest(req, res, req.body);
    };

    app.post('/mcp', handleMcp);
    app.get('/mcp', handleMcp);
    app.delete('/mcp', handleMcp);

    app.listen(port, host, () => {
      console.error(`PDCA MCP Server (HTTP) listening on http://${host}:${port}/mcp`);
    });
  } else {
    const { StdioServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/stdio.js'
    );
    const { server } = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('PDCA MCP Server (stdio) started');
  }
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
