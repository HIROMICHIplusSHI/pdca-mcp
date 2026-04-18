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

    const { default: express } = await import('express');
    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    );
    const { randomUUID } = await import('crypto');

    const app = express();
    app.use(express.json());

    const transport = new StreamableHTTPServerTransport({
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
    const { StdioServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/stdio.js'
    );
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('PDCA MCP Server (stdio) started');
  }
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
