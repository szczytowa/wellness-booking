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

export async function createReservation(user, date, hour, isAdmin = false, adminUser = null, note = null) {
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      user_code: user,
      date: formatDate(date),
      hour: hour,
      status: 'active',
      created_by: isAdmin ? adminUser : null,
      note: note
    })
    .select()
    .single()
  
  if (error) throw error
  
  // Log event with admin info
  await logEvent(
    isAdmin ? 'admin-booking' : 'reservation', 
    user, 
    formatDate(date), 
    hour,
    isAdmin ? adminUser : null,
    note
  )
  
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
    .update({ 
      status: 'cancelled',
      cancelled_by: isAdmin ? adminUser : null,
      cancelled_at: new Date().toISOString()
    })
    .eq('id', id)
  
  if (error) throw error
  
  // Log event with admin info
  await logEvent(
    isAdmin ? 'admin-cancel' : 'cancellation',
    reservation.user_code,
    reservation.date,
    reservation.hour,
    adminUser
  )
  
  return true
}

// Update reservation note
export async function updateReservationNote(id, note, adminUser) {
  const { error } = await supabase
    .from('reservations')
    .update({ note: note })
    .eq('id', id)
  
  if (error) throw error
  return true
}

export async function checkSlotAvailability(date, hour) {
  // Check both reservations and blocked slots
  const dateStr = formatDate(date)
  
  const { data: reservation } = await supabase
    .from('reservations')
    .select('id')
    .eq('date', dateStr)
    .eq('hour', hour)
    .eq('status', 'active')
    .single()
  
  if (reservation) return false
  
  const { data: blocked } = await supabase
    .from('blocked_slots')
    .select('id')
    .eq('date', dateStr)
    .eq('hour', hour)
    .single()
  
  if (blocked) return false
  
  return true
}

// ============ BLOCKED SLOTS ============

export async function getBlockedSlots() {
  const { data, error } = await supabase
    .from('blocked_slots')
    .select('*')
    .order('date', { ascending: true })
  
  if (error) throw error
  return data || []
}

export async function getBlockedSlotsForDate(date) {
  const { data, error } = await supabase
    .from('blocked_slots')
    .select('*')
    .eq('date', formatDate(date))
  
  if (error) throw error
  return data || []
}

export async function createBlockedSlot(date, hour, reason, adminUser) {
  const { data, error } = await supabase
    .from('blocked_slots')
    .insert({
      date: formatDate(date),
      hour: hour,
      reason: reason,
      created_by: adminUser
    })
    .select()
    .single()
  
  if (error) throw error
  
  // Log event - wrapped in try/catch to not break main action
  try {
    await logEvent('block', null, formatDate(date), hour, adminUser, reason)
  } catch (e) {
    console.warn('Failed to log block event:', e)
  }
  
  return data
}

export async function deleteBlockedSlot(id, adminUser) {
  const { data: slot, error: fetchError } = await supabase
    .from('blocked_slots')
    .select('*')
    .eq('id', id)
    .single()
  
  if (fetchError) throw fetchError
  
  const { error } = await supabase
    .from('blocked_slots')
    .delete()
    .eq('id', id)
  
  if (error) throw error
  
  // Log event - wrapped in try/catch to not break main action
  try {
    await logEvent('unblock', null, slot.date, slot.hour, adminUser)
  } catch (e) {
    console.warn('Failed to log unblock event:', e)
  }
  
  return true
}

// ============ EVENTS ============

export async function logEvent(type, user, date, hour, admin = null, note = null) {
  const { error } = await supabase
    .from('events')
    .insert({
      type,
      user_code: user,
      date,
      hour,
      admin_user: admin,
      note: note
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

// ============ STATISTICS ============

export async function getStatistics(dateFrom, dateTo) {
  const reservations = await getReservationsByDateRange(dateFrom, dateTo)
  const events = await getEvents(dateFrom, dateTo)
  
  // Count by day of week
  const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0] // Sun-Sat
  reservations.forEach(r => {
    if (r.status === 'active') {
      const date = new Date(r.date)
      byDayOfWeek[date.getDay()]++
    }
  })
  
  // Count by hour
  const byHour = {}
  reservations.forEach(r => {
    if (r.status === 'active') {
      byHour[r.hour] = (byHour[r.hour] || 0) + 1
    }
  })
  
  // Count by apartment
  const byApartment = {}
  reservations.forEach(r => {
    if (r.status === 'active') {
      byApartment[r.user_code] = (byApartment[r.user_code] || 0) + 1
    }
  })
  
  // Count by month
  const byMonth = {}
  reservations.forEach(r => {
    if (r.status === 'active') {
      const month = r.date.substring(0, 7) // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + 1
    }
  })
  
  // Cancellation rate
  const totalReservations = reservations.length
  const cancelled = reservations.filter(r => r.status === 'cancelled').length
  const cancellationRate = totalReservations > 0 ? (cancelled / totalReservations * 100).toFixed(1) : 0
  
  // Admin vs User bookings
  const adminBookings = events.filter(e => e.type === 'admin-booking').length
  const userBookings = events.filter(e => e.type === 'reservation').length
  
  return {
    totalActive: reservations.filter(r => r.status === 'active').length,
    totalCancelled: cancelled,
    cancellationRate,
    byDayOfWeek,
    byHour,
    byApartment,
    byMonth,
    adminBookings,
    userBookings,
    topApartments: Object.entries(byApartment)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    mostPopularHour: Object.entries(byHour)
      .sort((a, b) => b[1] - a[1])[0] || ['N/A', 0]
  }
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

export function subscribeToBlockedSlots(callback) {
  const subscription = supabase
    .channel('blocked-slots-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'blocked_slots'
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
