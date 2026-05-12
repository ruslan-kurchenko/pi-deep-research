/** Minimal contract for the pi-mcp-adapter proxy tool surface. */
export interface McpProxy {
  call(tool: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface MemPalaceResult {
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface AddDrawerInput {
  wing: string;
  room: string;
  title: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface SearchResponse {
  results?: MemPalaceResult[];
}

/**
 * Thin wrapper around the MemPalace MCP tools exposed by pi-mcp-adapter.
 *
 * In production, `proxy` is constructed from the `mcp` tool registered by
 * `pi-mcp-adapter`. In tests it is mocked.
 *
 * MCP tool names are sourced from the operator's MemPalace documentation:
 * - mempalace_search
 * - mempalace_add_drawer
 * - mempalace_status
 * - mempalace_kg_query
 */
export class MemPalaceClient {
  constructor(private readonly proxy: McpProxy) {}

  async search(query: string, wing?: string): Promise<MemPalaceResult[]> {
    const args: Record<string, unknown> = { query };
    if (wing) args["wing"] = wing;
    const res = (await this.proxy.call("mempalace_search", args)) as SearchResponse;
    return res.results ?? [];
  }

  async addDrawer(input: AddDrawerInput): Promise<void> {
    await this.proxy.call("mempalace_add_drawer", input as unknown as Record<string, unknown>);
  }

  async status(): Promise<unknown> {
    return this.proxy.call("mempalace_status", {});
  }

  async kgQuery(query: string, wing?: string): Promise<unknown> {
    const args: Record<string, unknown> = { query };
    if (wing) args["wing"] = wing;
    return this.proxy.call("mempalace_kg_query", args);
  }
}

/**
 * Build a MemPalaceClient from a live Pi extension context.
 * `mcpToolFn` should be the `mcp` tool callable registered by pi-mcp-adapter.
 *
 * Usage in command handlers:
 *   const mp = buildMemPalaceClient((tool, args) => ctx.callTool("mcp", { tool, args }));
 */
export function buildMemPalaceClient(
  mcpToolFn: (tool: string, args: Record<string, unknown>) => Promise<unknown>
): MemPalaceClient {
  return new MemPalaceClient({ call: mcpToolFn });
}
