import type { APIRoute } from "astro";
import { Resend } from "resend";
import { RESEND_API_KEY, FROM_EMAIL, TO_EMAIL } from "astro:env/server";

const resend = new Resend(RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  if (!email || !message) {
    return new Response(JSON.stringify({ ok: false, message: "Faltan campos" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return new Response(JSON.stringify({ ok: false, message: "Email inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject: "Información de contacto",
      replyTo: email,
      html: `${message}<br/><br/>Correo: ${email}`,
      text: `Mensaje: ${message}\nCorreo: ${email}`,
    });

    return new Response(JSON.stringify({ ok: true, message: "Enviado ✅" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: "Error enviando" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};