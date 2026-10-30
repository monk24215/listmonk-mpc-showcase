import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "../config.js";
import type { ListmonkClient } from "../listmonk.js";
import { registerTool } from "./helpers.js";

const SUB_STATUS = z.enum(["enabled", "disabled", "blocklisted"]);
const SUB_LIST_ACTION = z.enum(["add", "remove", "unsubscribe"]);

export function registerSubscriberTools(server: McpServer, cfg: Config, lm: ListmonkClient): number {
  let n = 0;

  n += +registerTool(
    server,
    cfg,
    {
      name: "subscribers_search",
      title: "Search subscribers",
      description:
        "Search subscribers. Pass query as a Listmonk SQL expression on the subscribers table, e.g. subscribers.email LIKE '%@example.com' or subscribers.status = 'blocklisted'. Omit query to list all.",
      kind: "read",
      inputSchema: {
        query: z.string().optional(),
        list_id: z.number().int().positive().optional(),
        subscription_status: z.enum(["unconfirmed", "confirmed", "unsubscribed"]).optional(),
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(100).default(20),
      },
    },
    async (args) =>
      lm.get("/subscribers", {
        query: args.query as string | undefined,
        list_id: args.list_id as number | undefined,
        subscription_status: args.subscription_status as string | undefined,
        page: args.page as number,
        per_page: args.per_page as number,
      }),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "subscriber_get",
      title: "Get subscriber",
      description: "One subscriber by id, including their list memberships.",
      kind: "read",
      inputSchema: { id: z.number().int().positive() },
    },
    async (args) => lm.get(`/subscribers/${Number(args.id)}`),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "subscriber_create",
      title: "Create subscriber",
      description:
        "Create a subscriber. list_ids subscribes them to lists. preconfirm skips double opt-in confirmation for double opt-in lists.",
      kind: "write",
      inputSchema: {
        email: z.string().email(),
        name: z.string().default(""),
        status: SUB_STATUS.default("enabled"),
        list_ids: z.array(z.number().int().positive()).default([]),
        attribs: z.record(z.unknown()).default({}),
        preconfirm: z.boolean().default(false),
      },
    },
    async (args) =>
      lm.post("/subscribers", {
        email: args.email,
        name: args.name,
        status: args.status,
        lists: args.list_ids,
        attribs: args.attribs,
        preconfirm_subscriptions: args.preconfirm,
      }),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "subscriber_update",
      title: "Update subscriber",
      description:
        "Update a subscriber. Only the fields you pass change. Passing list_ids replaces their list memberships; use subscribers_lists_change to add or remove without replacing.",
      kind: "write",
      inputSchema: {
        id: z.number().int().positive(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        status: SUB_STATUS.optional(),
        list_ids: z.array(z.number().int().positive()).optional(),
        attribs: z.record(z.unknown()).optional(),
        preconfirm: z.boolean().optional(),
      },
    },
    async (args) => {
      const id = Number(args.id);
      const current = await lm.get<Record<string, unknown>>(`/subscribers/${id}`);
      const currentLists = Array.isArray(current.lists)
        ? (current.lists as Array<{ id: number }>).map((l) => l.id)
        : [];
      const merged = {
        email: current.email,
        name: current.name,
        status: current.status,
        lists: currentLists,
        attribs: current.attribs ?? {},
        preconfirm_subscriptions: false,
        ...(args.email !== undefined ? { email: args.email } : {}),
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.status !== undefined ? { status: args.status } : {}),
        ...(args.list_ids !== undefined ? { lists: args.list_ids } : {}),
        ...(args.attribs !== undefined ? { attribs: args.attribs } : {}),
        ...(args.preconfirm !== undefined ? { preconfirm_subscriptions: args.preconfirm } : {}),
      };
      return lm.put(`/subscribers/${id}`, merged);
    },
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "subscribers_lists_change",
      title: "Change subscriber list membership",
      description:
        "Bulk add, remove, or unsubscribe subscribers from lists without replacing their other memberships. action: add | remove | unsubscribe.",
      kind: "write",
      inputSchema: {
        subscriber_ids: z.array(z.number().int().positive()).min(1),
        list_ids: z.array(z.number().int().positive()).min(1),
        action: SUB_LIST_ACTION,
        status: z.enum(["confirmed", "unconfirmed", "unsubscribed"]).optional(),
      },
    },
    async (args) =>
      lm.put("/subscribers/lists", {
        ids: args.subscriber_ids,
        action: args.action,
        target_list_ids: args.list_ids,
        ...(args.status ? { status: args.status } : {}),
      }),
  );

  n += +registerTool(
    server,
    cfg,
    {
      name: "subscriber_delete",
      title: "Delete subscriber",
      description: "Permanently delete a subscriber by id, with their list subscriptions and campaign history.",
      kind: "destructive",
      inputSchema: { id: z.number().int().positive() },
    },
    async (args) => lm.del(`/subscribers/${Number(args.id)}`),
  );

  return n;
}
