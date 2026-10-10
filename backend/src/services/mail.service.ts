import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

/**
 * Sends an email through SMTP when configured. Without SMTP, messages are only
 * printed in development (never in production, to avoid leaking tokens in logs).
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const transport = getTransporter();
  if (transport) {
    await transport.sendMail({ from: env.SMTP_FROM, ...message });
    return;
  }
  if (env.NODE_ENV === 'development') {
    logger.info('Email (SMTP not configured, development preview)', {
      to: message.to,
      subject: message.subject,
      body: message.text,
    });
    return;
  }
  logger.warn('Email not sent: SMTP is not configured', { subject: message.subject });
}
