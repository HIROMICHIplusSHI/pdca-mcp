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
