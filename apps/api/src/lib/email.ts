import { env } from "../env.js";

type SendArgs = {
  subject: string;
  html: string;
  text: string;
};

export async function sendNotification(
  log: { error: (...args: unknown[]) => void },
  args: SendArgs,
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.NOTIFICATION_EMAIL) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.NOTIFICATION_FROM,
        to: [env.NOTIFICATION_EMAIL],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      log.error({ status: res.status, body }, "resend send failed");
    }
  } catch (err) {
    log.error({ err }, "resend send threw");
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
