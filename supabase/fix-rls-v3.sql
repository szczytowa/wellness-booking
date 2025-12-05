-- ============================================================
-- POPRAWKA RLS - URUCHOM W SUPABASE SQL EDITOR
-- ============================================================

-- 1. Napraw polityki dla tabeli events (dodaj INSERT)
DROP POLICY IF EXISTS "Anyone can insert events" ON events;
CREATE POLICY "Anyone can insert events" ON events
    FOR INSERT WITH CHECK (true);

-- 2. Napraw polityki dla blocked_slots (wszystkie operacje)
DROP POLICY IF EXISTS "Everyone can view blocked slots" ON blocked_slots;
DROP POLICY IF EXISTS "Admins can insert blocked slots" ON blocked_slots;
DROP POLICY IF EXISTS "Admins can delete blocked slots" ON blocked_slots;

CREATE POLICY "Anyone can view blocked_slots" ON blocked_slots
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert blocked_slots" ON blocked_slots
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update blocked_slots" ON blocked_slots
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete blocked_slots" ON blocked_slots
    FOR DELETE USING (true);

-- 3. Sprawdź czy tabela events ma politykę INSERT
-- Jeśli nie, dodaj ją
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'events' AND policyname = 'Anyone can insert events'
    ) THEN
        EXECUTE 'CREATE POLICY "Anyone can insert events" ON events FOR INSERT WITH CHECK (true)';
    END IF;
END $$;

-- ============================================================
-- GOTOWE! Teraz blokowanie i odblokowanie powinno działać
-- ============================================================
