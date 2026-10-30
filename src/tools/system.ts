import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { ListmonkClient } from "../listmonk.js";
import { registerTool } from "./helpers.js";

const SECRET_KEY = /pass|secret|token|key|cred/i;

/** Replaces the value of any secret-looking key, recursively. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) && v !== "" && v !== null ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

export function registerSystemTools(server: McpServer, cfg: Config, lm: ListmonkClient): number {
  let n = 0;

  n += +registerTool(
    server,
    cfg,
    {
      name: "listmonk_status",
      title: "Listmonk status",
      description:
        "Server health, version, and build info. Start here when diagnosing anything. Returns {health, about, config}.",
      kind: "read",
      inputSchema: {},
    },
    async () => {
      const [health, about, config] = await Promise.all([
        lm.get("/health"),
        lm.get("/about"),
        lm.get("/config"),
      ]);
      return { health, about, config: redact(config) };
    },
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "listmonk_dashboard_counts",
      title: "Dashboard counts",
      description: "Totals across the instance: subscribers by status, lists, campaigns, and messages.",
      kind: "read",
      inputSchema: {},
    },
    async () => lm.get("/dashboard/counts"),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "listmonk_logs",
      title: "Server logs",
      description: "Recent Listmonk application log lines (ring buffer, not persisted).",
      kind: "read",
      inputSchema: {},
    },
    async () => lm.get("/logs"),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "listmonk_settings_get",
      title: "Get settings",
      description:
        "Instance settings. Passwords, keys, and tokens are replaced with [redacted] before being returned.",
      kind: "read",
      inputSchema: {},
    },
    async () => redact(await lm.get("/settings")),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "listmonk_smtp_test",
      title: "Test SMTP connection",
      description:
        "Opens a connection to a configured SMTP server and sends a test email to the given address. Sends real mail through the instance's SMTP settings.",
      kind: "write",
      inputSchema: {
        email: z.string().email().describe("Address to receive the test email"),
        smtp_index: z.number().int().min(0).describe("Index of the SMTP server in settings (0 = first)"),
      },
    },
    async (args) => {
      const settings = (await lm.get<Record<string, unknown>>("/settings")) as Record<string, unknown>;
      const smtp = (settings["smtp"] as Array<Record<string, unknown>> | undefined) ?? [];
      const server = smtp[Number(args.smtp_index)];
      if (!server) throw new Error(`No SMTP server at index ${args.smtp_index}`);
      return lm.post("/settings/smtp/test", { ...server, email: args.email });
    },
  );

  return n;
}