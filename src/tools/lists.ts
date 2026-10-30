import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { ListmonkClient } from "../listmonk.js";
import { registerTool } from "./helpers.js";

export function registerListTools(server: McpServer, cfg: Config, lm: ListmonkClient): number {
  let n = 0;

  n += +registerTool(
    server,
    cfg,
    {
      name: "lists_list",
      title: "List mailing lists",
      description: "All mailing lists with id, name, type, opt-in mode, tags, and subscriber counts.",
      kind: "read",
      inputSchema: {},
    },
    async () => lm.get("/lists", { per_page: "all" }),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "list_get",
      title: "Get mailing list",
      description: "One mailing list by id.",
      kind: "read",
      inputSchema: { id: z.number().int().positive() },
    },
    async (args) => lm.get(`/lists/${Number(args.id)}`),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "list_create",
      title: "Create mailing list",
      description: "Create a mailing list. type is 'public' or 'private'; optin is 'single' or 'double'.",
      kind: "write",
      inputSchema: {
        name: z.string().min(1),
        type: z.enum(["public", "private"]).default("private"),
        optin: z.enum(["single", "double"]).default("single"),
        tags: z.array(z.string()).default([]),
        description: z.string().default(""),
      },
    },
    async (args) => lm.post("/lists", args),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "list_update",
      title: "Update mailing list",
      description:
        "Update a mailing list. Only the fields you pass change; the rest are kept from the current list.",
      kind: "write",
      inputSchema: {
        id: z.number().int().positive(),
        name: z.string().min(1).optional(),
        type: z.enum(["public", "private"]).optional(),
        optin: z.enum(["single", "double"]).optional(),
        tags: z.array(z.string()).optional(),
        description: z.string().optional(),
      },
    },
    async (args) => {
      const id = Number(args.id);
      const current = await lm.get<Record<string, unknown>>(`/lists/${id}`);
      const merged = {
        name: current.name,
        type: current.type,
        optin: current.optin,
        tags: current.tags ?? [],
        description: current.description ?? "",
        ...Object.fromEntries(Object.entries(args).filter(([k, v]) => k !== "id" && v !== undefined)),
      };
      return lm.put(`/lists/${id}`, merged);
    },
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "list_delete",
      title: "Delete mailing list",
      description:
        "Permanently delete a mailing list by id. Subscriptions to it are removed; subscriber records are kept.",
      kind: "destructive",
      inputSchema: { id: z.number().int().positive() },
    },
    async (args) => lm.del(`/lists/${Number(args.id)}`),
  );

  return n;
}