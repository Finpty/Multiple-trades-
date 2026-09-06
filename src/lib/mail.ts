import { env } from "@/lib/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

export interface MailDriver {
  send(message: MailMessage): Promise<void>;
}

const logDriver: MailDriver = {
  async send(message) {
    console.info(`[mail:log] to=${message.to} subject="${message.subject}"\n${message.text}`);
  },
};

/** Minimal SMTP driver (no external dependency). Supports STARTTLS-less plain/implicit TLS + AUTH LOGIN. */
const smtpDriver: MailDriver = {
  async send(message) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } = env();
    if (!SMTP_HOST) throw new Error("SMTP_HOST is not configured");
    const net = await import("node:net");
    const tls = await import("node:tls");
    const port = Number(SMTP_PORT ?? 587);
    const secure = SMTP_SECURE === "true";
    const socket = secure ? tls.connect({ host: SMTP_HOST, port }) : net.connect({ host: SMTP_HOST, port });
    const from = message.from ?? env().MAIL_FROM;
    const fromAddr = from.match(/<([^>]+)>/)?.[1] ?? from;

    const read = () =>
      new Promise<string>((resolve, reject) => {
        socket.once("data", (d) => resolve(d.toString()));
        socket.once("error", reject);
      });
    const cmd = async (line: string) => {
      socket.write(line + "\r\n");
      const res = await read();
      if (/^[45]/.test(res)) throw new Error(`SMTP error for "${line.split(" ")[0]}": ${res.trim()}`);
      return res;
    };
    await read();
    await cmd(`EHLO tradeone`);
    if (SMTP_USER && SMTP_PASSWORD) {
      await cmd("AUTH LOGIN");
      await cmd(Buffer.from(SMTP_USER).toString("base64"));
      await cmd(Buffer.from(SMTP_PASSWORD).toString("base64"));
    }
    await cmd(`MAIL FROM:<${fromAddr}>`);
    await cmd(`RCPT TO:<${message.to}>`);
    await cmd("DATA");
    const body = [
      `From: ${from}`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      "MIME-Version: 1.0",
      message.html ? 'Content-Type: text/html; charset="utf-8"' : 'Content-Type: text/plain; charset="utf-8"',
      "",
      (message.html ?? message.text).replace(/\r?\n\./g, "\n.."),
      ".",
    ].join("\r\n");
    await cmd(body);
    await cmd("QUIT").catch(() => undefined);
    socket.end();
  },
};

export function getMailDriver(): MailDriver {
  return env().MAIL_DRIVER === "smtp" ? smtpDriver : logDriver;
}

export async function sendMail(message: MailMessage): Promise<void> {
  try {
    await getMailDriver().send(message);
  } catch (error) {
    // Email is best-effort; core operations never depend on delivery.
    console.error("[mail] delivery failed", error);
  }
}
