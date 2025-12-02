import { MONTHS_PL } from './supabase'

export const formatDate = (date) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const formatDatePL = (date) => {
  const d = new Date(date)
  return `${d.getDate()} ${MONTHS_PL[d.getMonth()]} ${d.getFullYear()}`
}

export const formatDateTime = (date, hour) => {
  return `${formatDatePL(date)}, ${hour}:00`
}

export const isSameDay = (date1, date2) => {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate()
}

export const getStartOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export const parseDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}
