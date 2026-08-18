import { createHash } from 'node:crypto';
import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import {
  FROM_EMAIL,
  RESEND_API_KEY,
  TO_EMAIL,
  TURNSTILE_SECRET_KEY,
} from 'astro:env/server';

const resend = new Resend(RESEND_API_KEY);

const MAX_BODY_BYTES = 24_000;
const MIN_FILL_TIME_MS = 2_500;
const MAX_FILL_TIME_MS = 24 * 60 * 60 * 1_000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const serviceLabels: Record<string, string> = {
  'landing-page': 'Landing page',
  'corporate-website': 'Sitio web corporativo',
  'performance-cro': 'Rendimiento / CRO',
  maintenance: 'Mantenimiento front-end',
  other: 'Otro',
};

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitStore = new Map<string, RateLimitEntry>();

const responseHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function jsonResponse(status: number, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders, ...extraHeaders },
  });
}

function localizedMessage(language: string, spanish: string, english: string) {
  return language === 'en' ? english : spanish;
}

function getText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function checkRateLimit(identifier: string) {
  const now = Date.now();

  if (rateLimitStore.size > 1_000) {
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt <= now) rateLimitStore.delete(key);
    }
  }

  const current = rateLimitStore.get(identifier);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

async function verifyTurnstile(token: string, clientAddress: string) {
  if (!TURNSTILE_SECRET_KEY) return true;
  if (!token || token.length > 2_048) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: clientAddress,
      }),
      signal: controller.signal,
    });

    if (!verification.ok) return false;
    const result = await verification.json() as { success?: boolean; action?: string };
    return result.success === true && result.action === 'contact';
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
    return jsonResponse(415, { ok: false, message: 'Formato de solicitud no permitido.' });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse(413, { ok: false, message: 'La solicitud es demasiado grande.' });
  }

  const rateLimit = checkRateLimit(clientAddress);
  if (!rateLimit.allowed) {
    const waitMinutes = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60));
    return jsonResponse(
      429,
      { ok: false, message: `Demasiados intentos. Espera ${waitMinutes} minutos.` },
      { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse(400, { ok: false, message: 'No se pudo leer la solicitud.' });
  }

  const language = getText(form, 'language') === 'en' ? 'en' : 'es';
  const successMessage = localizedMessage(
    language,
    'Mensaje enviado. Te responderé pronto.',
    'Message sent. I will reply soon.',
  );

  // Honeypot: bots commonly fill this off-screen field. Return a neutral success
  // response so the protection is not easy to fingerprint.
  if (getText(form, 'company_website')) {
    return jsonResponse(200, { ok: true, message: successMessage });
  }

  const startedAt = Number(getText(form, 'started_at'));
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(startedAt) || elapsed < MIN_FILL_TIME_MS) {
    return jsonResponse(200, { ok: true, message: successMessage });
  }
  if (elapsed > MAX_FILL_TIME_MS || elapsed < 0) {
    return jsonResponse(400, {
      ok: false,
      message: localizedMessage(language, 'Recarga la página e inténtalo nuevamente.', 'Reload the page and try again.'),
    });
  }

  const name = getText(form, 'name').replace(/\s+/g, ' ');
  const email = getText(form, 'email').toLowerCase();
  const service = getText(form, 'service');
  const message = getText(form, 'message');

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const fieldsAreValid =
    name.length >= 2 &&
    name.length <= 80 &&
    email.length <= 254 &&
    emailIsValid &&
    Object.hasOwn(serviceLabels, service) &&
    message.length >= 20 &&
    message.length <= 2_000;

  if (!fieldsAreValid) {
    return jsonResponse(400, {
      ok: false,
      message: localizedMessage(language, 'Revisa los datos ingresados.', 'Please review the information provided.'),
    });
  }

  const turnstileToken = getText(form, 'cf-turnstile-response');
  if (!(await verifyTurnstile(turnstileToken, clientAddress))) {
    return jsonResponse(400, {
      ok: false,
      message: localizedMessage(
        language,
        'No se pudo completar la verificación de seguridad. Inténtalo nuevamente.',
        'Security verification failed. Please try again.',
      ),
    });
  }

  const escapedName = escapeHtml(name);
  const escapedEmail = escapeHtml(email);
  const escapedService = escapeHtml(serviceLabels[service]);
  const escapedMessage = escapeHtml(message).replace(/\n/g, '<br />');
  const idempotencyHash = createHash('sha256')
    .update(`${email}|${service}|${message}|${Math.floor(Date.now() / 600_000)}`)
    .digest('hex');

  try {
    const { error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: `Nuevo contacto web: ${serviceLabels[service]}`,
        replyTo: email,
        html: `
          <h2>Nueva consulta desde davidbeslanga.com</h2>
          <p><strong>Nombre:</strong> ${escapedName}</p>
          <p><strong>Email:</strong> ${escapedEmail}</p>
          <p><strong>Servicio:</strong> ${escapedService}</p>
          <p><strong>Mensaje:</strong><br />${escapedMessage}</p>
        `,
        text: [
          'Nueva consulta desde davidbeslanga.com',
          `Nombre: ${name}`,
          `Email: ${email}`,
          `Servicio: ${serviceLabels[service]}`,
          `Mensaje: ${message}`,
        ].join('\n'),
      },
      { idempotencyKey: `contact-${idempotencyHash}` },
    );

    if (error) throw error;
    return jsonResponse(200, { ok: true, message: successMessage });
  } catch (error) {
    console.error('Contact form delivery failed', error);
    return jsonResponse(502, {
      ok: false,
      message: localizedMessage(
        language,
        'No se pudo enviar el mensaje. Escríbeme a contact@davidbeslanga.com.',
        'The message could not be sent. Email me at contact@davidbeslanga.com.',
      ),
    });
  }
};
