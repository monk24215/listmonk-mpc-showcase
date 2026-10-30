import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { ListmonkClient } from "../listmonk.js";
import { registerTool } from "./helpers.js";

export function registerTransactionalTools(server: McpServer, cfg: Config, lm: ListmonkClient): number {
  let n = 0;

  n += +registerTool(
    server,
    cfg,
    {
      name: "tx_send",
      title: "Send transactional email",
      description:
        "Send one transactional email from a 'tx' template to a subscriber email. data fills template placeholders. Sends real mail.",
      kind: "write",
      inputSchema: {
        template_id: z.number().int().positive(),
        subscriber_email: z.string().email(),
        data: z.record(z.unknown()).default({}),
        content_type: z.enum(["html", "markdown", "plain"]).default("html"),
        from_email: z.string().optional(),
        subject: z.string().optional(),
      },
    },
    async (args) =>
      lm.post("/tx", {
        template_id: args.template_id,
        subscriber_email: args.subscriber_email,
        data: args.data,
        content_type: args.content_type,
        ...(args.from_email ? { from_email: args.from_email } : {}),
        ...(args.subject ? { subject: args.subject } : {}),
      }),
  );

  return n;
}
