-- ============================================================
-- MIGRACJA BAZY DANYCH - NOWE FUNKCJE
-- ============================================================
-- Uruchom ten skrypt w Supabase SQL Editor
-- ============================================================

-- 1. Dodaj kolumny do tabeli reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Dodaj kolumnę note do tabeli events
ALTER TABLE events ADD COLUMN IF NOT EXISTS note TEXT;

-- 3. Utwórz tabelę blocked_slots (zablokowane terminy)
CREATE TABLE IF NOT EXISTS blocked_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    reason TEXT DEFAULT 'Zablokowane',
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, hour)
);

-- 4. Włącz RLS dla blocked_slots
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

-- 5. Polityki RLS dla blocked_slots
CREATE POLICY "Everyone can view blocked slots" ON blocked_slots
    FOR SELECT USING (true);

CREATE POLICY "Admins can insert blocked slots" ON blocked_slots
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can delete blocked slots" ON blocked_slots
    FOR DELETE USING (true);

-- 6. Włącz Realtime dla blocked_slots
ALTER PUBLICATION supabase_realtime ADD TABLE blocked_slots;

-- 7. Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_blocked_slots_date ON blocked_slots(date);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_date_hour ON blocked_slots(date, hour);
CREATE INDEX IF NOT EXISTS idx_reservations_note ON reservations(note) WHERE note IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_admin ON events(admin_user) WHERE admin_user IS NOT NULL;

-- ============================================================
-- GOTOWE! Nowe funkcje:
-- - Notatki do rezerwacji
-- - Info który admin anulował
-- - Blokowanie terminów
-- ============================================================
