import type { Config } from "./config.js";

export class ListmonkError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ListmonkError";
  }
}

export interface RequestOpts {
  query?: Record<string, string | number | boolean | undefined | Array<string | number>>;
  body?: unknown;
}

/**
 * Thin client for the Listmonk REST API. Every successful response is
 * {"data": ...}; this returns the unwrapped data. Errors surface as
 * ListmonkError with Listmonk's own message.
 */
export class ListmonkClient {
  private readonly auth: string;

  constructor(private readonly cfg: Config) {
    this.auth = "Basic " + Buffer.from(`${cfg.apiUser}:${cfg.apiToken}`).toString("base64");
  }

  async request<T = unknown>(method: string, path: string, opts: RequestOpts = {}): Promise<T> {
    const url = new URL(`${this.cfg.listmonkUrl}/api${path}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }

    const init: RequestInit = {
      method,
      headers: { Authorization: this.auth, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    };
    if (opts.body !== undefined) {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw new ListmonkError(0, `Cannot reach Listmonk at ${this.cfg.listmonkUrl}: ${(err as Error).message}`);
    }

    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // Non-JSON body (e.g. an HTML error page from a proxy).
    }

    if (!res.ok) {
      const msg =
        (json as { message?: string } | undefined)?.message ??
        (text ? text.slice(0, 300) : res.statusText);
      if (res.status === 401 || res.status === 403) {
        throw new ListmonkError(
          res.status,
          `Listmonk rejected the API credentials or permission (${res.status}): ${msg}. ` +
            `Check LISTMONK_API_USER / LISTMONK_API_TOKEN and the user's role.`,
        );
      }
      throw new ListmonkError(res.status, `Listmonk ${method} ${path} failed (${res.status}): ${msg}`);
    }

    return ((json as { data?: T } | undefined)?.data ?? (json as T)) as T;
  }

  get<T = unknown>(path: string, query?: RequestOpts["query"]) {
    return this.request<T>("GET", path, { query });
  }
  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, { body });
  }
  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, { body });
  }
  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, { body });
  }
  del<T = unknown>(path: string, query?: RequestOpts["query"]) {
    return this.request<T>("DELETE", path, { query });
  }
}