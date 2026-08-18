# David Beslanga — Portafolio profesional

Portafolio bilingüe construido con Astro y Tailwind CSS. Presenta servicios, experiencia y proyectos, e incluye un formulario de contacto conectado a Resend.

## Desarrollo local

```sh
npm install
npm run dev
```

La compilación de producción se valida con:

```sh
npm run build
npx tsc --noEmit
```

## Variables de entorno

Copia `.env.example` a `.env` y configura:

- `RESEND_API_KEY`: clave privada de Resend.
- `FROM_EMAIL`: remitente de un dominio verificado en Resend.
- `TO_EMAIL`: correo que recibirá las consultas.
- `PUBLIC_TURNSTILE_SITE_KEY`: clave pública opcional de Cloudflare Turnstile.
- `TURNSTILE_SECRET_KEY`: clave privada opcional de Cloudflare Turnstile.

Las dos variables de Turnstile deben configurarse juntas. Si están presentes, el formulario muestra el widget y valida cada token en el servidor.

## Protección del formulario

El endpoint aplica validación del lado del servidor, límite de tamaño, rate limiting por IP, honeypot, control de tiempo, protección de origen, escape de HTML e idempotencia en el envío. La ruta antigua de Astro Actions fue eliminada para evitar un segundo punto de entrada sin estas protecciones.

## SEO

El sitio incluye URL canónica, metadatos sociales, datos estructurados, etiquetas `hreflang`, `robots.txt` y `sitemap.xml`. Después de desplegar, registra el dominio en Google Search Console y envía `https://davidbeslanga.com/sitemap.xml`.
