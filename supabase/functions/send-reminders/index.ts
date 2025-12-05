// Edge Function: send-reminders
// Cron job - sprawdza rezerwacje za 30 min i wysyła przypomnienia
// Uruchamiany co 10 minut przez Supabase Cron

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

async function sendReminderEmail(reservation: any) {
  const date = formatDate(reservation.date)
  const time = `${reservation.hour}:00`
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Wellness - Przypomnienie</h1>
      </div>
      <div style="background: #eff6ff; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1d4ed8; margin-top: 0;">Rezerwacja za 30 minut!</h2>
        <p><strong>Apartament:</strong> ${reservation.user_code}</p>
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Godzina:</strong> ${time}</p>
        ${reservation.note ? `<p><strong>Notatka:</strong> ${reservation.note}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #bfdbfe; margin: 20px 0;">
        <p style="color: #666; font-size: 12px; margin: 0;">
          Wiadomość wygenerowana automatycznie przez system Wellness Booking
        </p>
      </div>
    </div>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Wellness Booking <onboarding@resend.dev>',
      to: [ADMIN_EMAIL],
      subject: `⏰ Za 30 min: ${reservation.user_code} - ${time}`,
      html: html,
    }),
  })

  return response.ok
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!RESEND_API_KEY || !ADMIN_EMAIL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Pobierz aktualny czas
    const now = new Date()
    const today = now.toISOString().split('T')[0] // YYYY-MM-DD
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    // Sprawdź rezerwacje na dziś
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('date', today)
      .eq('status', 'active')
      .is('reminder_sent', null) // Tylko te, dla których nie wysłano przypomnienia

    if (error) throw error

    let sentCount = 0

    for (const reservation of reservations || []) {
      // Oblicz różnicę czasową
      const reservationMinutes = reservation.hour * 60
      const currentMinutes = currentHour * 60 + currentMinute
      const diffMinutes = reservationMinutes - currentMinutes

      // Wyślij przypomnienie jeśli rezerwacja za 25-35 minut
      if (diffMinutes >= 25 && diffMinutes <= 35) {
        const sent = await sendReminderEmail(reservation)
        
        if (sent) {
          // Oznacz że przypomnienie wysłane
          await supabase
            .from('reservations')
            .update({ reminder_sent: new Date().toISOString() })
            .eq('id', reservation.id)
          
          sentCount++
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        checked: reservations?.length || 0,
        sent: sentCount,
        timestamp: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-reminders:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
