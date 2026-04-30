import { and, eq, isNotNull } from "drizzle-orm";
import { env } from "../env.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(
  log: { error: (...args: unknown[]) => void },
  args: SendArgs,
): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const recipients = Array.isArray(args.to) ? args.to : [args.to];
  if (recipients.length === 0) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.NOTIFICATION_FROM,
        to: recipients,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      log.error(
        { status: res.status, body, to: recipients },
        "resend send failed",
      );
    }
  } catch (err) {
    log.error({ err, to: recipients }, "resend send threw");
  }
}

export async function adminEmailRecipients(): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.isAdmin, true), isNotNull(users.email)));
  const emails = rows
    .map((r) => r.email)
    .filter((e): e is string => typeof e === "string" && e.length > 0);

  if (emails.length === 0 && env.NOTIFICATION_EMAIL) {
    return [env.NOTIFICATION_EMAIL];
  }
  return emails;
}

export async function sendAdminNotification(
  log: { error: (...args: unknown[]) => void },
  args: Omit<SendArgs, "to">,
): Promise<void> {
  const to = await adminEmailRecipients();
  if (to.length === 0) return;
  await sendEmail(log, { ...args, to });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
