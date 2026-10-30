import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";
import type { Config } from "../config.js";
import { ListmonkError } from "../listmonk.js";

export type Kind = "read" | "write" | "destructive";

export interface ToolDef<S extends ZodRawShape> {
  name: string;
  title: string;
  description: string;
  kind: Kind;
  inputSchema: S;
}

export type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export function textResult(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

export function errorResult(err: unknown): ToolResult {
  const msg = err instanceof ListmonkError ? err.message : `Unexpected error: ${(err as Error).message}`;
  return { content: [{ type: "text", text: msg }], isError: true };
}

/**
 * Registers a tool. In read-only mode, write and destructive tools are skipped
 * entirely (not registered), so clients never see them.
 */
export function registerTool<S extends ZodRawShape>(
  server: McpServer,
  cfg: Config,
  def: ToolDef<S>,
  handler: (args: Record<string, unknown>) => Promise<unknown>,
): boolean {
  if (cfg.readOnly && def.kind !== "read") return false;

  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.inputSchema,
      annotations: {
        readOnlyHint: def.kind === "read",
        destructiveHint: def.kind === "destructive",
        idempotentHint: def.kind === "read",
        openWorldHint: true,
      },
    },
    // The SDK types the callback from the zod shape; args are validated by the SDK
    // before this runs, so the loose cast here is intentional.
    (async (args: any) => {
      try {
        return textResult(await handler(args as Record<string, unknown>));
      } catch (err) {
        return errorResult(err);
      }
    }) as any,
  );
  return true;
}