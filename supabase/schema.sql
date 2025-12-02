-- =============================================
-- WELLNESS BOOKING SYSTEM - SUPABASE SCHEMA
-- =============================================
-- Run this SQL in Supabase SQL Editor (Dashboard -> SQL Editor)

-- 1. Create reservations table
CREATE TABLE IF NOT EXISTS reservations (
    id BIGSERIAL PRIMARY KEY,
    user_code VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 14 AND hour <= 19),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create events table (for logging all actions)
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(30) NOT NULL CHECK (type IN ('reservation', 'cancellation', 'admin-cancel')),
    user_code VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    hour INTEGER NOT NULL,
    admin_user VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_code);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_date_hour ON reservations(date, hour) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- 4. Create unique constraint to prevent double booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking 
ON reservations(date, hour) 
WHERE status = 'active';

-- 5. Enable Row Level Security (RLS)
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 6. Create policies for public access (since we don't use auth)
-- IMPORTANT: In production, you might want more restrictive policies

-- Reservations policies
CREATE POLICY "Allow read reservations" ON reservations
    FOR SELECT USING (true);

CREATE POLICY "Allow insert reservations" ON reservations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update reservations" ON reservations
    FOR UPDATE USING (true);

-- Events policies
CREATE POLICY "Allow read events" ON events
    FOR SELECT USING (true);

CREATE POLICY "Allow insert events" ON events
    FOR INSERT WITH CHECK (true);

-- 7. Enable Realtime for reservations table
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;

-- 8. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Create trigger for updated_at
DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VERIFICATION QUERIES (optional - run to check)
-- =============================================

-- Check tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check indexes:
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public';

-- Test insert (optional):
-- INSERT INTO reservations (user_code, date, hour) VALUES ('APARTAMENT 1', '2024-01-15', 14);
-- SELECT * FROM reservations;
