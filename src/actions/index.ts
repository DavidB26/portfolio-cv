import { ActionError, defineAction } from "astro:actions";
import { FROM_EMAIL, RESEND_API_KEY, TO_EMAIL } from "astro:env/server";
import { z } from "astro:schema";
import { Resend } from "resend"

const resend = new Resend(RESEND_API_KEY)

export const server = {
  sendContactEmail: defineAction({
    accept: 'form',
    input: z.object({
      email: z.string().email(),
      message: z.string().min(1),
    }),
    handler: async(input) =>  {
      const { email, message } = input
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        subject: 'Información de contacto',
        html: `${message}<br/>Correo de contacto: ${email}`,
        text: 'Alguien desea contactarte'
      })
      
      if (error) {
        throw new ActionError({
          code: 'BAD_REQUEST',
          message: error.message
        })
      }
      return data
    }
  })
}