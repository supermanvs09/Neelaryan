import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight edge gate for the console: no session cookie → sign-in page.
 * The real checks (valid session, password changed, permissions) happen on the
 * server in the admin layout and in every API route.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/admin") && !req.cookies.get("nr_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname + search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/admin/:path*"] };
