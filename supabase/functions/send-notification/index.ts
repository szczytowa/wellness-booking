// Edge Function: send-notification
// Wysyła powiadomienia email przez Resend

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') // Ustaw w Supabase Secrets

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  type: 'new_reservation' | 'cancellation' | 'reminder' | 'admin_booking' | 'admin_cancel'
  reservation: {
    user_code: string
    date: string
    hour: number
    note?: string
    created_by?: string
  }
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

function getEmailSubject(type: string, reservation: any): string {
  const date = formatDate(reservation.date)
  const time = `${reservation.hour}:00`
  
  switch (type) {
    case 'new_reservation':
      return `🟢 Nowa rezerwacja: ${reservation.user_code} - ${date} ${time}`
    case 'cancellation':
      return `🔴 Anulowanie: ${reservation.user_code} - ${date} ${time}`
    case 'reminder':
      return `⏰ Przypomnienie: ${reservation.user_code} za 30 min (${time})`
    case 'admin_booking':
      return `🔵 Rezerwacja (admin): ${reservation.user_code} - ${date} ${time}`
    case 'admin_cancel':
      return `🟠 Anulowanie (admin): ${reservation.user_code} - ${date} ${time}`
    default:
      return `Wellness - powiadomienie`
  }
}

function getEmailBody(type: string, reservation: any): string {
  const date = formatDate(reservation.date)
  const time = `${reservation.hour}:00`
  
  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🌿 Wellness Booking</h1>
      </div>
      <div style="background: #f0fdf4; padding: 30px; border-radius: 0 0 10px 10px;">
  `
  
  switch (type) {
    case 'new_reservation':
      html += `
        <h2 style="color: #16a34a; margin-top: 0;">✅ Nowa rezerwacja</h2>
        <p><strong>Apartament:</strong> ${reservation.user_code}</p>
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Godzina:</strong> ${time}</p>
        ${reservation.note ? `<p><strong>Notatka:</strong> ${reservation.note}</p>` : ''}
      `
      break
    case 'cancellation':
      html += `
        <h2 style="color: #dc2626; margin-top: 0;">❌ Rezerwacja anulowana</h2>
        <p>Użytkownik anulował rezerwację:</p>
        <p><strong>Apartament:</strong> ${reservation.user_code}</p>
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Godzina:</strong> ${time}</p>
      `
      break
    case 'reminder':
      html += `
        <h2 style="color: #2563eb; margin-top: 0;">⏰ Przypomnienie - za 30 minut</h2>
        <p><strong>Apartament:</strong> ${reservation.user_code}</p>
        <p><strong>Godzina:</strong> ${time}</p>
        ${reservation.note ? `<p><strong>Notatka:</strong> ${reservation.note}</p>` : ''}
      `
      break
    case 'admin_booking':
      html += `
        <h2 style="color: #2563eb; margin-top: 0;">📝 Rezerwacja przez admina</h2>
        <p><strong>Apartament:</strong> ${reservation.user_code}</p>
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Godzina:</strong> ${time}</p>
        <p><strong>Admin:</strong> ${reservation.created_by || 'Admin'}</p>
        ${reservation.note ? `<p><strong>Notatka:</strong> ${reservation.note}</p>` : ''}
      `
      break
    case 'admin_cancel':
      html += `
        <h2 style="color: #ea580c; margin-top: 0;">🚫 Anulowanie przez admina</h2>
        <p><strong>Apartament:</strong> ${reservation.user_code}</p>
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Godzina:</strong> ${time}</p>
        <p><strong>Admin:</strong> ${reservation.created_by || 'Admin'}</p>
      `
      break
  }
  
  html += `
        <hr style="border: none; border-top: 1px solid #bbf7d0; margin: 20px 0;">
        <p style="color: #666; font-size: 12px; margin: 0;">
          Wiadomość wygenerowana automatycznie przez system Wellness Booking
        </p>
      </div>
    </div>
  `
  
  return html
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured')
    }
    if (!ADMIN_EMAIL) {
      throw new Error('ADMIN_EMAIL not configured')
    }

    const payload: NotificationPayload = await req.json()
    const { type, reservation } = payload

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Wellness Booking <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject: getEmailSubject(type, reservation),
        html: getEmailBody(type, reservation),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email')
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
