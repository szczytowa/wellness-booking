import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============================================================
// WERSJA TESTOWA - LOGOWANIE NAZWAMI APARTAMENTÓW
// ============================================================
// Użytkownicy logują się wpisując: APARTAMENT 1, APARTAMENT 2, itd.
// Admini logują się wpisując: AGNIESZKA lub ADMIN (z hasłem 111)
// ============================================================

// Lista adminów
export const ADMINS = ['AGNIESZKA', 'ADMIN']

// Lista użytkowników (do raportów)
export const USERS = [
  'APARTAMENT 1',
  'APARTAMENT 2',
  'APARTAMENT 3',
  'APARTAMENT 4',
  'APARTAMENT 5',
  'APARTAMENT 6',
  'APARTAMENT 7',
  'APARTAMENT 8',
  'APARTAMENT 9',
  'APARTAMENT 10',
  'APARTAMENT 11',
  'APARTAMENT 12',
  'APARTAMENT 13',
  'APARTAMENT 14',
  'APARTAMENT 15',
  'APARTAMENT 16',
  'APARTAMENT 17',
  'APARTAMENT 18'
]

// Wszystkie prawidłowe kody
export const VALID_CODES = [...USERS, ...ADMINS]

// Funkcja do walidacji (wersja testowa - nazwy apartamentów)
export function validatePin(code) {
  const trimmedCode = code.trim().toUpperCase()
  
  // Sprawdź czy to admin z hasłem (np. "AGNIESZKA-111" lub "ADMIN-111")
  if (trimmedCode.endsWith('-111')) {
    const adminName = trimmedCode.replace('-111', '')
    if (ADMINS.includes(adminName)) {
      return {
        valid: true,
        user: adminName,
        isAdmin: true
      }
    }
  }
  
  // Sprawdź czy to użytkownik (APARTAMENT X)
  if (USERS.includes(trimmedCode)) {
    return {
      valid: true,
      user: trimmedCode,
      isAdmin: false
    }
  }
  
  return { valid: false, user: null, isAdmin: false }
}

// ============ TIME SLOTS ============
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
