# 🌿 Strefa Wellness - System Rezerwacji

System rezerwacji strefy wellness dla apartamentów z panelem administracyjnym.

## 📋 Funkcjonalności

### Użytkownicy (APARTAMENT 1-18)
- ✅ Logowanie kodem apartamentu (bez hasła)
- ✅ Rezerwacja slotów (14:00-19:00)
- ✅ Podgląd dostępności w kalendarzu
- ✅ Odwoływanie rezerwacji (do 60 min przed)
- ✅ Limit: 1 rezerwacja na 2 dni kalendarzowe
- ✅ Blokada minionych godzin
- ✅ Rezerwacja: dziś + 3 dni do przodu

### Administratorzy (AGNIESZKA-111, ADMIN-111)
- ✅ Podgląd wszystkich rezerwacji (bez limitu dat)
- ✅ Rezerwacja dla dowolnego użytkownika
- ✅ Odwoływanie dowolnych rezerwacji
- ✅ Raport "Zrealizowane" z podsumowaniem
- ✅ Raport "Analiza" - miesięczne zestawienie
- ✅ Raport "Full" - wszystkie zdarzenia
- ✅ Audit Log - historia wszystkich zmian
- ✅ Monitor błędów aplikacji
- ✅ Export do Excel/PDF

### 🔒 Bezpieczeństwo
- ✅ Row Level Security (RLS) w Supabase
- ✅ Walidacja po stronie serwera (triggers)
- ✅ Content Security Policy (CSP)
- ✅ HTTPS headers bezpieczeństwa
- ✅ Audit log wszystkich operacji
- ✅ Automatyczne czyszczenie starych danych

### 📱 PWA (Progressive Web App)
- ✅ Instalacja na telefonie/tablecie
- ✅ Tryb offline z fallback page
- ✅ Cache dla szybszego ładowania

## 🚀 Szybki Start

### 1. Konfiguracja Supabase

1. Utwórz konto na [supabase.com](https://supabase.com)
2. Stwórz nowy projekt
3. Przejdź do **SQL Editor** i wykonaj zawartość pliku `supabase/schema-v2.sql`
4. Przejdź do **Settings → API** i skopiuj:
   - `Project URL` 
   - `anon public` key

### 2. Konfiguracja projektu

```bash
# Sklonuj/pobierz projekt
cd wellness-booking

# Zainstaluj zależności
npm install

# Skopiuj plik środowiskowy
cp .env.example .env
```

Edytuj `.env` i wpisz swoje dane Supabase:
```env
VITE_SUPABASE_URL=https://twoj-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=twoj-anon-key
```

### 3. Generowanie ikon PWA

```bash
# Wymaga ImageMagick
chmod +x scripts/generate-icons.sh
./scripts/generate-icons.sh

# Lub użyj online: https://realfavicongenerator.net/
```

### 4. Uruchom lokalnie

```bash
npm run dev
```

Aplikacja będzie dostępna pod `http://localhost:5173`

### 5. Deploy na Vercel

```bash
# Zainstaluj Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Lub przez GitHub → Vercel Dashboard.

## 🔐 Kody dostępu

### Użytkownicy
- `APARTAMENT 1` do `APARTAMENT 18`

### Administratorzy
- `AGNIESZKA-111`
- `ADMIN-111`

## 📁 Struktura projektu

```
wellness-booking/
├── src/
│   ├── components/
│   │   ├── AdminPanel.jsx    # Panel administratora
│   │   ├── Calendar.jsx      # Komponent kalendarza
│   │   ├── Header.jsx        # Nagłówek
│   │   ├── LoginPage.jsx     # Strona logowania
│   │   ├── Modal.jsx         # Okno modalne
│   │   ├── Toast.jsx         # Powiadomienia
│   │   └── UserPanel.jsx     # Panel użytkownika
│   ├── lib/
│   │   ├── api.js            # Funkcje API + error logging
│   │   ├── supabase.js       # Konfiguracja Supabase
│   │   └── utils.js          # Funkcje pomocnicze
│   ├── App.jsx               # Główny komponent
│   ├── index.css             # Style globalne
│   └── main.jsx              # Entry point
├── supabase/
│   ├── schema.sql            # Schema v1 (stara)
│   └── schema-v2.sql         # Schema v2 z RLS, triggers, audit
├── public/
│   ├── icons/                # Ikony PWA
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service Worker
│   ├── offline.html          # Strona offline
│   └── favicon.svg
├── scripts/
│   └── generate-icons.sh     # Generator ikon PWA
├── .env.example
├── vercel.json               # Konfiguracja + security headers
├── package.json
└── README.md
```

## 🔒 Security Headers (vercel.json)

| Header | Opis |
|--------|------|
| `X-Content-Type-Options` | Zapobiega MIME sniffing |
| `X-Frame-Options` | Blokuje osadzanie w iframe |
| `X-XSS-Protection` | Ochrona przed XSS |
| `Referrer-Policy` | Kontrola referrer |
| `Content-Security-Policy` | Ogranicza źródła zasobów |
| `Permissions-Policy` | Blokuje camera/mic/geo |

## 🗃️ Supabase Schema v2

### Tabele
- `reservations` - rezerwacje
- `events` - zdarzenia (rezerwacja/odwołanie)
- `audit_log` - szczegółowy log zmian
- `app_errors` - błędy aplikacji
- `valid_codes` - lista prawidłowych kodów

### Triggery
- `ensure_slot_available` - sprawdza dostępność przed rezerwacją
- `update_reservations_updated_at` - aktualizuje timestamp
- `audit_reservations` - loguje wszystkie zmiany

### Automatyczne czyszczenie
```sql
-- Uruchom ręcznie lub przez pg_cron
SELECT cleanup_old_data();
```

Usuwa:
- Rezerwacje starsze niż 2 lata
- Events starsze niż 2 lata
- Audit log starszy niż 1 rok
- Błędy starsze niż 3 miesiące

## 📱 PWA - Instalacja

### Android
1. Otwórz stronę w Chrome
2. Menu (⋮) → "Dodaj do ekranu głównego"

### iOS
1. Otwórz stronę w Safari
2. Przycisk udostępniania → "Dodaj do ekranu początkowego"

### Desktop
1. Otwórz stronę w Chrome/Edge
2. Ikona instalacji w pasku adresu lub Menu → "Zainstaluj"

## 📝 Zasady rezerwacji

| Reguła | Opis |
|--------|------|
| Dostępne dni | Dzisiaj + 3 dni do przodu |
| Godziny | 14:00 - 19:00 (sloty co godzinę) |
| Czas trwania | 50 minut |
| Limit | 1 rezerwacja na 2 dni kalendarzowe |
| Odwołanie | Min. 60 minut przed terminem |
| 20:00-21:00 | Otwarte dla pozostałych (bez rezerwacji) |
| Minione godziny | Automatycznie blokowane |

## 🐛 Rozwiązywanie problemów

### "Missing Supabase environment variables"
- Sprawdź czy plik `.env` istnieje
- Sprawdź poprawność kluczy Supabase

### Błąd RLS "new row violates row-level security policy"
- Sprawdź czy tabela `valid_codes` zawiera wszystkie kody
- Uruchom ponownie `schema-v2.sql`

### PWA nie instaluje się
- Sprawdź czy strona działa na HTTPS
- Sprawdź czy manifest.json jest dostępny
- Sprawdź konsolę przeglądarki (F12)

### Ikony PWA nie wyświetlają się
- Wygeneruj ikony PNG używając `scripts/generate-icons.sh`
- Lub użyj generatora online

## 📄 Licencja

MIT License

---

Utworzono z ❤️ dla Strefy Wellness
