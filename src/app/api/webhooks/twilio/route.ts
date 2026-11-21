import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/server/db";
import { verifyTwilioSignature } from "@/server/messaging/providers";
import { siteBase } from "@/server/messaging/notify";

/**
 * Twilio message status callback. Signed with the account's auth token; unsigned or
 * mis-signed requests are rejected. Updates the delivery log.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));
  const url = `${siteBase()}/api/webhooks/twilio`;
  if (!verifyTwilioSignature(url, params, req.headers.get("x-twilio-signature"))) return new NextResponse("Invalid signature", { status: 403 });
  const sid = params.MessageSid;
  const status = params.MessageStatus;
  if (sid && status) {
    if (status === "delivered" || status === "read") await q("update notifications set status = 'delivered', delivered_at = now() where provider_message_id = $1", [sid]);
    else if (status === "failed" || status === "undelivered")
      await q("update notifications set status = 'failed', error = $2 where provider_message_id = $1", [sid, `Twilio: ${status}${params.ErrorCode ? ` (${params.ErrorCode})` : ""}`]);
  }
  return new NextResponse(null, { status: 204 });
}
