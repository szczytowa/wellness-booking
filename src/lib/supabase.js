import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============ CONSTANTS ============
export const USERS = Array.from({ length: 18 }, (_, i) => `APARTAMENT ${i + 1}`)
export const ADMINS = ['AGNIESZKA-111', 'ADMIN-111']
export const VALID_CODES = [...USERS, ...ADMINS]

export const TIME_SLOTS = [
  { hour: 14, bookable: true },
  { hour: 15, bookable: true },
  { hour: 16, bookable: true },
  { hour: 17, bookable: true },
  { hour: 18, bookable: true },
  { hour: 19, bookable: true },
  { hour: 20, bookable: false, info: 'OTWARTE DLA POZOSTAŁYCH' },
  { hour: 21, bookable: false, info: 'OTWARTE DLA POZOSTAŁYCH' }
]

export const DAYS_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So']
export const MONTHS_PL = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 
                         'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
