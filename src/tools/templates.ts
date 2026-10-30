import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { ListmonkClient } from "../listmonk.js";
import { registerTool } from "./helpers.js";

export function registerTemplateTools(server: McpServer, cfg: Config, lm: ListmonkClient): number {
  let n = 0;

  n += +registerTool(
    server,
    cfg,
    {
      name: "templates_list",
      title: "List templates",
      description: "All campaign and transactional templates with id, name, type, and default flag.",
      kind: "read",
      inputSchema: {},
    },
    async () => lm.get("/templates"),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "template_get",
      title: "Get template",
      description: "One template by id, including its HTML body.",
      kind: "read",
      inputSchema: { id: z.number().int().positive() },
    },
    async (args) => lm.get(`/templates/${Number(args.id)}`),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "template_create",
      title: "Create template",
      description:
        "Create a template. type is 'campaign' (for campaigns) or 'tx' (for transactional sends). body must contain {{ template \"content\" . }} for campaign templates.",
      kind: "write",
      inputSchema: {
        name: z.string().min(1),
        type: z.enum(["campaign", "tx"]),
        subject: z.string().default(""),
        body: z.string().min(1),
      },
    },
    async (args) => lm.post("/templates", { name: args.name, type: args.type, subject: args.subject, body: args.body }),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "template_update",
      title: "Update template",
      description: "Update a template. Only the fields you pass change.",
      kind: "write",
      inputSchema: {
        id: z.number().int().positive(),
        name: z.string().min(1).optional(),
        subject: z.string().optional(),
        body: z.string().optional(),
      },
    },
    async (args) => {
      const id = Number(args.id);
      const current = await lm.get<Record<string, any>>(`/templates/${id}`);
      const merged = {
        name: current.name,
        type: current.type,
        subject: current.subject ?? "",
        body: current.body,
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.subject !== undefined ? { subject: args.subject } : {}),
        ...(args.body !== undefined ? { body: args.body } : {}),
      };
      return lm.put(`/templates/${id}`, merged);
    },
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "template_delete",
      title: "Delete template",
      description: "Permanently delete a template. Listmonk refuses to delete the default template or one in use by a campaign.",
      kind: "destructive",
      inputSchema: { id: z.number().int().positive() },
    },
    async (args) => lm.del(`/templates/${Number(args.id)}`),
  );

  return n;
}
