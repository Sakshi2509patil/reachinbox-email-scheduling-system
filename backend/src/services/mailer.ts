import nodemailer, { Transporter } from "nodemailer";
import { Sender } from "@prisma/client";

const transporterCache = new Map<string, Transporter>();

function getTransporter(sender: Sender): Transporter {
  let t = transporterCache.get(sender.id);
  if (t) return t;

  t = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: false,
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass,
    },
  });
  transporterCache.set(sender.id, t);
  return t;
}

export async function sendEmail(
  sender: Sender,
  to: string,
  subject: string,
  body: string
): Promise<{ messageId: string; previewUrl: string | false }> {
  const transporter = getTransporter(sender);
  const info = await transporter.sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to,
    subject,
    text: body,
    html: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
}
