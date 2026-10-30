#!/usr/bin/env node
import { timingSafeEqual } from "node:crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig, type Config } from "./config.js";
import { ListmonkClient } from "./listmonk.js";
import { registerSystemTools } from "./tools/system.js";
import { registerListTools } from "./tools/lists.js";
import { registerSubscriberTools } from "./tools/subscribers.js";
import { registerCampaignTools } from "./tools/campaigns.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerBounceTools } from "./tools/bounces.js";
import { registerTransactionalTools } from "./tools/transactional.js";

export const SERVER_NAME = "listmonk-mcp";
export const SERVER_VERSION = "0.1.0";

export function buildServer(cfg: Config): { server: McpServer; registered: number } {
  const lm = new ListmonkClient(cfg);
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  const registered = registerSystemTools(server, cfg, lm) + registerListTools(server, cfg, lm) + registerSubscriberTools(server, cfg, lm) + registerCampaignTools(server, cfg, lm) + registerTemplateTools(server, cfg, lm) + registerBounceTools(server, cfg, lm) + registerTransactionalTools(server, cfg, lm);
  return { server, registered };
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function runStdio(cfg: Config): Promise<void> {
  const { server, registered } = buildServer(cfg);
  await server.connect(new StdioServerTransport());
  console.error(
    `${SERVER_NAME} v${SERVER_VERSION} ready on stdio · ${registered} tools · ` +
      `Listmonk ${cfg.listmonkUrl} · ${cfg.readOnly ? "READ-ONLY" : "read-write"}`,
  );
}

/**
 * Stateless streamable HTTP. Auth: "Authorization: Bearer <MCP_HTTP_TOKEN>",
 * or the token as the path segment: POST /mcp/<MCP_HTTP_TOKEN>.
 * Note: the /mcp/<token> URL is itself the secret.
 */
async function runHttp(cfg: Config): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const authorized = (req: express.Request): boolean => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const pathToken = req.params.token ?? "";
    return (
      (bearer !== "" && safeEqual(bearer, cfg.httpToken)) ||
      (pathToken !== "" && safeEqual(pathToken, cfg.httpToken))
    );
  };

  const handle = async (req: express.Request, res: express.Response) => {
    if (!authorized(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { server } = buildServer(cfg);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };

  app.post("/mcp", handle);
  app.post("/mcp/:token", handle);
  app.get("/health", (_req, res) => res.json({ ok: true, name: SERVER_NAME, version: SERVER_VERSION }));

  app.listen(cfg.httpPort, () => {
    console.error(
      `${SERVER_NAME} v${SERVER_VERSION} listening on http :${cfg.httpPort} · ` +
        `${cfg.readOnly ? "READ-ONLY" : "read-write"}`,
    );
  });
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (cfg.transport === "http") await runHttp(cfg);
  else await runStdio(cfg);
}

main().catch((err) => {
  console.error(`${SERVER_NAME} failed to start: ${(err as Error).message}`);
  process.exit(1);
});