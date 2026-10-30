import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { ListmonkClient } from "../listmonk.js";
import { registerTool } from "./helpers.js";

export function registerBounceTools(server: McpServer, cfg: Config, lm: ListmonkClient): number {
  let n = 0;

  n += +registerTool(
    server,
    cfg,
    {
      name: "bounces_search",
      title: "Search bounces",
      description: "Recorded bounces, newest first. Filter by bounce type (soft, hard, complaint) and campaign.",
      kind: "read",
      inputSchema: {
        type: z.enum(["soft", "hard", "complaint"]).optional(),
        campaign_id: z.number().int().positive().optional(),
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(100).default(20),
      },
    },
    async (args) =>
      lm.get("/bounces", {
        type: args.type as string | undefined,
        campaign_id: args.campaign_id as number | undefined,
        page: args.page as number,
        per_page: args.per_page as number,
      }),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "bounce_get",
      title: "Get bounce",
      description: "One bounce record by id.",
      kind: "read",
      inputSchema: { id: z.number().int().positive() },
    },
    async (args) => lm.get(`/bounces/${Number(args.id)}`),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "bounce_delete",
      title: "Delete bounce record",
      description:
        "Delete a bounce record by id. Does not change the subscriber's status; use subscriber_update to re-enable a subscriber.",
      kind: "destructive",
      inputSchema: { id: z.number().int().positive() },
    },
    async (args) => lm.del(`/bounces/${Number(args.id)}`),
  );

  return n;
}
