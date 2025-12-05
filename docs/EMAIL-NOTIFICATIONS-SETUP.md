# 📧 Konfiguracja Powiadomień Email - Wellness Booking

## Przegląd

System powiadomień email dla admina:
- ✅ Nowa rezerwacja (użytkownik lub admin)
- ✅ Anulowanie rezerwacji
- ✅ Przypomnienie 30 min przed wizytą

---

## KROK 1: Załóż konto Resend (2 minuty)

1. Wejdź na https://resend.com
2. Kliknij "Sign Up" → załóż konto (email + hasło lub GitHub)
3. Po zalogowaniu przejdź do "API Keys"
4. Kliknij "Create API Key"
   - Name: `wellness-booking`
   - Permission: `Full access`
5. **Skopiuj klucz API** (zaczyna się od `re_...`)

---

## KROK 2: Dodaj sekrety w Supabase (2 minuty)

1. Wejdź do Supabase Dashboard → Twój projekt
2. Przejdź do: **Project Settings** → **Edge Functions** → **Secrets**
3. Dodaj następujące sekrety:

| Name | Value |
|------|-------|
| `RESEND_API_KEY` | `re_xxxxxxxx...` (klucz z Resend) |
| `ADMIN_EMAIL` | `twoj@email.pl` (email admina) |

4. Kliknij "Save"

---

## KROK 3: Wgraj Edge Functions (5 minut)

### Opcja A: Przez Supabase CLI (zalecana)

1. Zainstaluj Supabase CLI:
```bash
npm install -g supabase
```

2. Zaloguj się:
```bash
supabase login
```

3. Połącz z projektem:
```bash
supabase link --project-ref TWOJ_PROJECT_REF
```
(Project ref znajdziesz w: Project Settings → General)

4. Wgraj funkcje:
```bash
cd wellness-booking
supabase functions deploy send-notification
supabase functions deploy send-reminders
```

### Opcja B: Przez Dashboard (ręcznie)

1. Supabase Dashboard → **Edge Functions**
2. Kliknij "Create a new function"
3. Name: `send-notification`
4. Wklej kod z pliku: `supabase/functions/send-notification/index.ts`
5. Kliknij "Deploy"
6. Powtórz dla `send-reminders`

---

## KROK 4: Skonfiguruj Database Webhooks (3 minuty)

### Webhook 1: Nowa rezerwacja

1. Supabase Dashboard → **Database** → **Webhooks**
2. Kliknij "Create a new webhook"
3. Wypełnij:
   - **Name:** `notify-new-reservation`
   - **Table:** `reservations`
   - **Events:** ✅ Insert
   - **Type:** `Supabase Edge Function`
   - **Edge Function:** `send-notification`
   - **HTTP Headers:**
     ```
     Content-Type: application/json
     ```
   - **Payload:** 
     ```json
     {
       "type": "new_reservation",
       "reservation": {
         "id": "{{ record.id }}",
         "user_code": "{{ record.user_code }}",
         "date": "{{ record.date }}",
         "hour": "{{ record.hour }}",
         "note": "{{ record.note }}",
         "created_by": "{{ record.created_by }}"
       }
     }
     ```
4. Kliknij "Create webhook"

### Webhook 2: Anulowanie rezerwacji

1. Kliknij "Create a new webhook"
2. Wypełnij:
   - **Name:** `notify-cancellation`
   - **Table:** `reservations`
   - **Events:** ✅ Update
   - **Type:** `Supabase Edge Function`
   - **Edge Function:** `send-notification`
   - **Payload:**
     ```json
     {
       "type": "cancellation",
       "reservation": {
         "id": "{{ record.id }}",
         "user_code": "{{ record.user_code }}",
         "date": "{{ record.date }}",
         "hour": "{{ record.hour }}",
         "cancelled_by": "{{ record.cancelled_by }}"
       }
     }
     ```
   - **Filter (ważne!):** Dodaj warunek żeby wysyłać tylko przy anulowaniu:
     ```
     old_record.status = 'active' AND record.status = 'cancelled'
     ```
3. Kliknij "Create webhook"

---

## KROK 5: Skonfiguruj Cron dla przypomnień (2 minuty)

1. Supabase Dashboard → **Edge Functions**
2. Znajdź funkcję `send-reminders`
3. Kliknij "**Schedules**" (lub "Add schedule")
4. Wypełnij:
   - **Name:** `check-reminders`
   - **Schedule:** `*/10 * * * *` (co 10 minut)
5. Kliknij "Create schedule"

---

## KROK 6: Dodaj kolumnę reminder_sent (1 minuta)

1. Supabase Dashboard → **SQL Editor**
2. Wklej i uruchom:

```sql
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reminder_sent TIMESTAMPTZ;
```

---

## KROK 7: Test! 🧪

1. Zaloguj się do aplikacji jako użytkownik
2. Zrób rezerwację
3. Sprawdź email admina (może być w SPAM za pierwszym razem!)
4. Oznacz jako "Nie spam" / dodaj do kontaktów

---

## Rozwiązywanie problemów

### Email nie przychodzi?

1. Sprawdź folder SPAM
2. Sprawdź logi Edge Function:
   - Supabase → Edge Functions → send-notification → Logs
3. Sprawdź czy sekrety są ustawione:
   - Project Settings → Edge Functions → Secrets

### Błąd "Missing environment variables"?

Upewnij się że dodałeś oba sekrety:
- `RESEND_API_KEY`
- `ADMIN_EMAIL`

### Przypomnienia nie działają?

1. Sprawdź czy Cron jest aktywny:
   - Edge Functions → send-reminders → Schedules
2. Sprawdź logi funkcji

---

## Koszty

| Usługa | Darmowy limit | Twoje użycie (~) |
|--------|---------------|------------------|
| Resend | 3000 emaili/mies. | ~600 emaili/mies. |
| Supabase Edge Functions | 500K wywołań/mies. | ~5K wywołań/mies. |
| Supabase Cron | Unlimited | ~4.3K/mies. |

**Całkowity koszt: 0 PLN** ✅

---

## Przyszłe rozszerzenia

Gdy dodasz domenę i klamkę smart:

1. Dodaj domenę w Resend (weryfikacja DNS)
2. Zmień `from` w Edge Functions na `rezerwacje@twojadomena.pl`
3. Dodaj funkcję wysyłania kodu do klamki dla gości

---

Gotowe! 🎉
