import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { ListmonkClient } from "../listmonk.js";
import { registerTool } from "./helpers.js";

const CONTENT_TYPE = z.enum(["richtext", "html", "markdown", "plain"]);

export function registerCampaignTools(server: McpServer, cfg: Config, lm: ListmonkClient): number {
  let n = 0;

  n += +registerTool(
    server,
    cfg,
    {
      name: "campaigns_search",
      title: "Search campaigns",
      description:
        "List campaigns. Filter by status (draft, scheduled, running, paused, cancelled, finished) and optional query text.",
      kind: "read",
      inputSchema: {
        status: z.enum(["draft", "scheduled", "running", "paused", "cancelled", "finished"]).optional(),
        query: z.string().optional(),
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(100).default(20),
      },
    },
    async (args) =>
      lm.get("/campaigns", {
        query: args.query as string | undefined,
        status: args.status as string | undefined,
        page: args.page as number,
        per_page: args.per_page as number,
      }),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "campaign_get",
      title: "Get campaign",
      description: "One campaign by id, including body, lists, and send statistics.",
      kind: "read",
      inputSchema: { id: z.number().int().positive() },
    },
    async (args) => lm.get(`/campaigns/${Number(args.id)}`),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "campaign_create",
      title: "Create campaign draft",
      description:
        "Create a campaign as a draft. Nothing is sent until campaign_set_status moves it to running or scheduled.",
      kind: "write",
      inputSchema: {
        name: z.string().min(1),
        subject: z.string().min(1),
        from_email: z.string().min(1).describe("Sender, e.g. 'Name <address@domain>'"),
        list_ids: z.array(z.number().int().positive()).min(1),
        body: z.string().default(""),
        content_type: CONTENT_TYPE.default("richtext"),
        template_id: z.number().int().positive().optional(),
        tags: z.array(z.string()).default([]),
        send_at: z.string().optional().describe("RFC 3339 timestamp; set to schedule on start"),
        type: z.enum(["regular", "optin"]).default("regular"),
      },
    },
    async (args) =>
      lm.post("/campaigns", {
        name: args.name,
        subject: args.subject,
        from_email: args.from_email,
        lists: args.list_ids,
        type: args.type,
        content_type: args.content_type,
        body: args.body,
        template_id: args.template_id,
        tags: args.tags,
        send_at: args.send_at ?? null,
        messenger: "email",
      }),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "campaign_update",
      title: "Update campaign",
      description:
        "Update a campaign. Only the fields you pass change. Listmonk only allows edits while the campaign is a draft, scheduled, or paused.",
      kind: "write",
      inputSchema: {
        id: z.number().int().positive(),
        name: z.string().min(1).optional(),
        subject: z.string().min(1).optional(),
        from_email: z.string().min(1).optional(),
        list_ids: z.array(z.number().int().positive()).min(1).optional(),
        body: z.string().optional(),
        content_type: CONTENT_TYPE.optional(),
        template_id: z.number().int().positive().optional(),
        tags: z.array(z.string()).optional(),
        send_at: z.string().nullable().optional(),
      },
    },
    async (args) => {
      const id = Number(args.id);
      const current = await lm.get<Record<string, any>>(`/campaigns/${id}`);
      const currentLists = Array.isArray(current.lists)
        ? (current.lists as Array<{ id: number }>).map((l) => l.id)
        : [];
      const merged = {
        name: current.name,
        subject: current.subject,
        from_email: current.from_email,
        lists: currentLists,
        type: current.type,
        content_type: current.content_type,
        body: current.body,
        template_id: current.template_id,
        tags: current.tags ?? [],
        send_at: current.send_at ?? null,
        messenger: current.messenger ?? "email",
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.subject !== undefined ? { subject: args.subject } : {}),
        ...(args.from_email !== undefined ? { from_email: args.from_email } : {}),
        ...(args.list_ids !== undefined ? { lists: args.list_ids } : {}),
        ...(args.body !== undefined ? { body: args.body } : {}),
        ...(args.content_type !== undefined ? { content_type: args.content_type } : {}),
        ...(args.template_id !== undefined ? { template_id: args.template_id } : {}),
        ...(args.tags !== undefined ? { tags: args.tags } : {}),
        ...(args.send_at !== undefined ? { send_at: args.send_at } : {}),
      };
      return lm.put(`/campaigns/${id}`, merged);
    },
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "campaign_set_status",
      title: "Change campaign status",
      description:
        "Start, schedule, pause, resume, or cancel a campaign. 'running' SENDS EMAIL to all recipients immediately. 'scheduled' sends at send_at. Confirm the recipient lists and body before using.",
      kind: "destructive",
      inputSchema: {
        id: z.number().int().positive(),
        status: z.enum(["running", "scheduled", "paused", "cancelled"]),
      },
    },
    async (args) => lm.put(`/campaigns/${Number(args.id)}/status`, { status: args.status }),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "campaign_test_send",
      title: "Send campaign test",
      description: "Send a test copy of a campaign to up to 10 email addresses. Sends real mail to those addresses.",
      kind: "write",
      inputSchema: {
        id: z.number().int().positive(),
        emails: z.array(z.string().email()).min(1).max(10),
      },
    },
    async (args) => lm.post(`/campaigns/${Number(args.id)}/test`, { subscribers: args.emails }),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "campaign_delete",
      title: "Delete campaign",
      description: "Permanently delete a campaign and its view and click statistics. Listmonk rejects deletion of running campaigns.",
      kind: "destructive",
      inputSchema: { id: z.number().int().positive() },
    },
    async (args) => lm.del(`/campaigns/${Number(args.id)}`),
  );

  return n;
}
