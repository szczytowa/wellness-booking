# 🌿 Strefa Wellness - System Rezerwacji

System rezerwacji strefy wellness dla apartamentów z panelem administracyjnym.

## 📋 Funkcjonalności

### Użytkownicy (APARTAMENT 1-18)
- ✅ Logowanie kodem apartamentu (bez hasła)
- ✅ Rezerwacja slotów (14:00-19:00)
- ✅ Podgląd dostępności w kalendarzu
- ✅ Odwoływanie rezerwacji (do 60 min przed)
- ✅ Limit: 1 rezerwacja na 2 dni kalendarzowe

### Administratorzy (AGNIESZKA-111, ADMIN-111)
- ✅ Podgląd wszystkich rezerwacji
- ✅ Odwoływanie dowolnych rezerwacji
- ✅ Raport "Zrealizowane" z podsumowaniem
- ✅ Raport "Full" - wszystkie zdarzenia
- ✅ Export do Excel/PDF
- ✅ Filtrowanie po datach

## 🚀 Szybki Start

### 1. Konfiguracja Supabase

1. Utwórz konto na [supabase.com](https://supabase.com)
2. Stwórz nowy projekt
3. Przejdź do **SQL Editor** i wykonaj zawartość pliku `supabase/schema.sql`
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

### 3. Uruchom lokalnie

```bash
npm run dev
```

Aplikacja będzie dostępna pod `http://localhost:5173`

### 4. Deploy na Vercel

#### Opcja A: Vercel CLI
```bash
# Zainstaluj Vercel CLI
npm i -g vercel

# Zaloguj się
vercel login

# Deploy
vercel
```

#### Opcja B: GitHub + Vercel Dashboard

1. Wrzuć projekt na GitHub
2. Zaloguj się na [vercel.com](https://vercel.com)
3. Kliknij "New Project" → Import z GitHub
4. Dodaj zmienne środowiskowe:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

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
│   │   ├── api.js            # Funkcje API (Supabase)
│   │   ├── supabase.js       # Konfiguracja Supabase
│   │   └── utils.js          # Funkcje pomocnicze
│   ├── App.jsx               # Główny komponent
│   ├── index.css             # Style globalne
│   └── main.jsx              # Entry point
├── supabase/
│   └── schema.sql            # Schema bazy danych
├── public/
│   └── favicon.svg
├── .env.example              # Przykład zmiennych środowiskowych
├── vercel.json               # Konfiguracja Vercel
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## ⚙️ Konfiguracja Supabase - szczegóły

### Włączenie Realtime (opcjonalne)
Dla automatycznej synchronizacji między użytkownikami:

1. Supabase Dashboard → Database → Replication
2. Włącz "realtime" dla tabeli `reservations`

### Row Level Security
Polityki RLS są już skonfigurowane w `schema.sql`. 
Dla środowiska produkcyjnego rozważ bardziej restrykcyjne polityki.

## 🛠️ Rozwój

```bash
# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview
```

## 📝 Zasady rezerwacji

| Reguła | Opis |
|--------|------|
| Dostępne dni | Dzisiaj + 2 dni do przodu |
| Godziny | 14:00 - 19:00 (sloty co godzinę) |
| Czas trwania | 50 minut |
| Limit | 1 rezerwacja na 2 dni kalendarzowe |
| Odwołanie | Min. 60 minut przed terminem |
| 20:00-21:00 | Otwarte dla pozostałych (bez rezerwacji) |

## 🐛 Rozwiązywanie problemów

### "Missing Supabase environment variables"
- Sprawdź czy plik `.env` istnieje
- Sprawdź poprawność kluczy Supabase

### Błąd połączenia z bazą
- Sprawdź czy projekt Supabase jest aktywny
- Sprawdź czy schema została poprawnie utworzona

### Rezerwacje się nie aktualizują
- Włącz Realtime w Supabase dla tabeli `reservations`

## 📄 Licencja

MIT License

---

Utworzono z ❤️ dla Strefy Wellness
