export interface Config {
  listmonkUrl: string;
  apiUser: string;
  apiToken: string;
  readOnly: boolean;
  transport: "stdio" | "http";
  httpPort: number;
  httpToken: string;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return v.trim();
}

function flag(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") return def;
  return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
}

export function loadConfig(): Config {
  const transport = (process.env.MCP_TRANSPORT ?? "stdio").trim().toLowerCase();
  if (transport !== "stdio" && transport !== "http") {
    throw new Error(`MCP_TRANSPORT must be "stdio" or "http", got "${transport}"`);
  }

  const cfg: Config = {
    listmonkUrl: required("LISTMONK_URL").replace(/\/+$/, ""),
    apiUser: required("LISTMONK_API_USER"),
    apiToken: required("LISTMONK_API_TOKEN"),
    readOnly: flag("LISTMONK_MCP_READONLY", false),
    transport,
    httpPort: Number(process.env.MCP_HTTP_PORT ?? "3100"),
    httpToken: process.env.MCP_HTTP_TOKEN ?? "",
  };

  if (cfg.transport === "http" && cfg.httpToken.length < 24) {
    throw new Error("MCP_HTTP_TOKEN must be set to at least 24 characters for HTTP transport");
  }
  return cfg;
}