import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { SESSION_COOKIE, userFromToken, type SessionUser } from "./auth/session";
import type { Permission } from "./auth/permissions";
import { customerFromRequest, type SessionCustomer } from "./customers/session";

/** An error whose message is safe to show to the person using the app. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "ERROR",
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const bad = (message: string, fields?: Record<string, string>) => new ApiError(400, message, "INVALID", fields);
export const notFound = (what = "That record") => new ApiError(404, `${what} wasn't found.`, "NOT_FOUND");
export const conflict = (message: string) => new ApiError(409, message, "CONFLICT");

export interface Ctx {
  req: NextRequest;
  ip: string | null;
  user: SessionUser | null;
  customer: SessionCustomer | null;
  params: Record<string, string>;
}

export interface Options {
  /** "user" requires a staff session; "public" allows anyone. */
  auth?: "user" | "public";
  /** Permission(s) required — any one of them is enough. */
  permission?: Permission | Permission[];
  /** Allowed while the user still has to change their password. */
  allowPendingPasswordChange?: boolean;
}

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

/** Mutating requests must come from our own pages (CSRF defence on top of SameSite cookies). */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function can(user: SessionUser | null, permission: Permission | Permission[]) {
  if (!user) return false;
  const need = Array.isArray(permission) ? permission : [permission];
  return need.some((p) => user.permissions.includes(p));
}

export function requirePermission(ctx: Ctx, permission: Permission | Permission[]) {
  if (!can(ctx.user, permission)) throw new ApiError(403, "You don't have permission to do that.", "FORBIDDEN");
}

type Handler = (ctx: Ctx) => Promise<unknown>;

/**
 * Wraps a route handler: authentication, permission check, CSRF check,
 * consistent JSON errors. Handlers return plain data (or a Response).
 */
export function api(handler: Handler, opts: Options = {}) {
  return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD" && !sameOrigin(req)) {
        throw new ApiError(403, "Request blocked (cross-site).", "CSRF");
      }
      const user = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
      const auth = opts.auth ?? "user";
      if (auth === "user") {
        if (!user) throw new ApiError(401, "Please sign in.", "UNAUTHENTICATED");
        if (user.mustChangePassword && !opts.allowPendingPasswordChange) {
          throw new ApiError(403, "Please change your password to continue.", "PASSWORD_CHANGE_REQUIRED");
        }
        if (opts.permission && !can(user, opts.permission)) throw new ApiError(403, "You don't have permission to do that.", "FORBIDDEN");
      }
      const customer = auth === "public" ? await customerFromRequest(req) : null;
      const params = (await context?.params) ?? {};
      const out = await handler({ req, ip: clientIp(req), user, customer, params });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message, code: e.code, fields: e.fields }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of e.issues) fields[i.path.join(".") || "_"] = i.message;
    const first = e.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join(".") ? `${first.path.join(".")}: ` : ""}${first.message}` : "Invalid input.", code: "INVALID", fields },
      { status: 400 },
    );
  }
  const pgCode = (e as { code?: string })?.code;
  if (pgCode === "23505") return NextResponse.json({ error: "That already exists — please use a different value.", code: "DUPLICATE" }, { status: 409 });
  if (pgCode === "23503") return NextResponse.json({ error: "That record is still in use elsewhere.", code: "IN_USE" }, { status: 409 });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong on our side. Please try again.", code: "SERVER" }, { status: 500 });
}

/** Largest JSON body any route accepts. Keeps oversized payloads away from validation entirely. */
export const MAX_JSON_BYTES = 256 * 1024;

export async function body<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<output<S>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_JSON_BYTES) throw new ApiError(413, "That request is too large.", "TOO_LARGE");
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw bad("The request body couldn't be read.");
  }
  if (Buffer.byteLength(text) > MAX_JSON_BYTES) throw new ApiError(413, "That request is too large.", "TOO_LARGE");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw bad("The request body isn't valid JSON.");
  }
  return schema.parse(raw);
}

export function searchParams<S extends ZodTypeAny>(req: NextRequest, schema: S): output<S> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

/** CSV download response. */
export function csv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // guard against CSV formula injection in spreadsheet apps
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const text = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  return new Response(text, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename.replace(/[^a-z0-9._-]/gi, "_")}"`,
    },
  });
}
