import { supabase } from './supabase'
import { formatDate } from './utils'

// ============ ERROR LOGGING ============

export async function logError(error, userCode = null, extraData = {}) {
  try {
    const { error: logErr } = await supabase
      .from('app_errors')
      .insert({
        error_type: error.name || 'Error',
        error_message: error.message,
        error_stack: error.stack,
        user_code: userCode,
        page_url: typeof window !== 'undefined' ? window.location.href : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        extra_data: extraData
      })
    
    if (logErr) console.error('Failed to log error:', logErr)
  } catch (e) {
    console.error('Error logging failed:', e)
  }
}

// Global error handler setup
export function setupErrorLogging(userCode = null) {
  if (typeof window === 'undefined') return

  window.onerror = (message, source, lineno, colno, error) => {
    logError(error || new Error(message), userCode, {
      source,
      lineno,
      colno
    })
  }

  window.onunhandledrejection = (event) => {
    logError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      userCode,
      { type: 'unhandledrejection' }
    )
  }
}

// ============ AUDIT LOG ============

export async function getAuditLog(limit = 100, offset = 0) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (error) throw error
  return data || []
}

export async function getAppErrors(limit = 50) {
  const { data, error } = await supabase
    .from('app_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data || []
}

// ============ RESERVATIONS ============

export async function getReservations() {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('status', 'active')
    .order('date', { ascending: true })
  
  if (error) throw error
  return data || []
}

export async function getReservationsByUser(user) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('user_code', user)
    .eq('status', 'active')
    .order('date', { ascending: true })
  
  if (error) throw error
  return data || []
}

export async function getReservationsByDateRange(dateFrom, dateTo) {
  let query = supabase
    .from('reservations')
    .select('*')
    .order('date', { ascending: true })
  
  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('date', dateTo)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createReservation(user, date, hour) {
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      user_code: user,
      date: formatDate(date),
      hour: hour,
      status: 'active'
    })
    .select()
    .single()
  
  if (error) throw error
  
  // Log event
  await logEvent('reservation', user, formatDate(date), hour)
  
  return data
}

export async function cancelReservation(id, user, isAdmin = false, adminUser = null) {
  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', id)
    .single()
  
  if (fetchError) throw fetchError
  
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', id)
  
  if (error) throw error
  
  // Log event
  await logEvent(
    isAdmin ? 'admin-cancel' : 'cancellation',
    reservation.user_code,
    reservation.date,
    reservation.hour,
    adminUser
  )
  
  return true
}

export async function checkSlotAvailability(date, hour) {
  const { data, error } = await supabase
    .from('reservations')
    .select('id')
    .eq('date', formatDate(date))
    .eq('hour', hour)
    .eq('status', 'active')
    .single()
  
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
  return !data // true if slot is available
}

// ============ EVENTS ============

export async function logEvent(type, user, date, hour, admin = null) {
  const { error } = await supabase
    .from('events')
    .insert({
      type,
      user_code: user,
      date,
      hour,
      admin_user: admin
    })
  
  if (error) throw error
}

export async function getEvents(dateFrom, dateTo) {
  let query = supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('date', dateTo)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// ============ REAL-TIME SUBSCRIPTIONS ============

export function subscribeToReservations(callback) {
  const subscription = supabase
    .channel('reservations-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reservations'
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()
  
  return () => {
    subscription.unsubscribe()
  }
}
