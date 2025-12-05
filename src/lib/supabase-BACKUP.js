import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============ KODY PIN -> APARTAMENTY ============
// ZMIEŃ TE KODY NA SWOJE WŁASNE PRZED WDROŻENIEM!
export const PIN_CODES = {
  // Użytkownicy: 4-cyfrowy PIN -> Nazwa apartamentu
  '3847': 'APARTAMENT 1',
  '9214': 'APARTAMENT 2',
  '5738': 'APARTAMENT 3',
  '2951': 'APARTAMENT 4',
  '8463': 'APARTAMENT 5',
  '1597': 'APARTAMENT 6',
  '6824': 'APARTAMENT 7',
  '3059': 'APARTAMENT 8',
  '7412': 'APARTAMENT 9',
  '4286': 'APARTAMENT 10',
  '9573': 'APARTAMENT 11',
  '1648': 'APARTAMENT 12',
  '8321': 'APARTAMENT 13',
  '5094': 'APARTAMENT 14',
  '2767': 'APARTAMENT 15',
  '6130': 'APARTAMENT 16',
  '4853': 'APARTAMENT 17',
  '7926': 'APARTAMENT 18',
  // Admini: 6-cyfrowy PIN -> Nazwa admina
  '847291': 'AGNIESZKA',
  '315978': 'ADMIN'
}

// Lista adminów (nazwy, nie PINy)
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

// Wszystkie prawidłowe nazwy (do walidacji w bazie)
export const VALID_CODES = [...USERS, ...ADMINS]

// Funkcja do walidacji PINu i zwrócenia nazwy użytkownika
export function validatePin(pin) {
  const trimmedPin = pin.trim()
  if (PIN_CODES[trimmedPin]) {
    return {
      valid: true,
      user: PIN_CODES[trimmedPin],
      isAdmin: ADMINS.includes(PIN_CODES[trimmedPin])
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
