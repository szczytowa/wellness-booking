-- =============================================
-- WELLNESS BOOKING SYSTEM - SUPABASE SCHEMA v2
-- Enhanced with: RLS, Triggers, Audit Log, Auto-cleanup
-- =============================================
-- Run this SQL in Supabase SQL Editor (Dashboard -> SQL Editor)
-- If upgrading from v1, run the "UPGRADE FROM V1" section at the bottom

-- =============================================
-- 1. TABLES
-- =============================================

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
    id BIGSERIAL PRIMARY KEY,
    user_code VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 14 AND hour <= 19),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(50), -- who created (for admin bookings)
    cancelled_by VARCHAR(50), -- who cancelled
    cancelled_at TIMESTAMPTZ
);

-- Events table (basic logging)
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(30) NOT NULL CHECK (type IN ('reservation', 'cancellation', 'admin-cancel', 'admin-booking')),
    user_code VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    hour INTEGER NOT NULL,
    admin_user VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log table (detailed logging)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id BIGINT,
    user_code VARCHAR(50),
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App errors table (for error monitoring)
CREATE TABLE IF NOT EXISTS app_errors (
    id BIGSERIAL PRIMARY KEY,
    error_type VARCHAR(100),
    error_message TEXT,
    error_stack TEXT,
    user_code VARCHAR(50),
    page_url TEXT,
    user_agent TEXT,
    extra_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_code);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_date_hour ON reservations(date, hour) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_code);
CREATE INDEX IF NOT EXISTS idx_app_errors_created ON app_errors(created_at);

-- Unique constraint to prevent double booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking 
ON reservations(date, hour) 
WHERE status = 'active';

-- =============================================
-- 3. VALID USER CODES LIST
-- =============================================

-- Create a table for valid codes (easier to manage)
CREATE TABLE IF NOT EXISTS valid_codes (
    code VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert valid codes
INSERT INTO valid_codes (code, type) VALUES
    ('APARTAMENT 1', 'user'),
    ('APARTAMENT 2', 'user'),
    ('APARTAMENT 3', 'user'),
    ('APARTAMENT 4', 'user'),
    ('APARTAMENT 5', 'user'),
    ('APARTAMENT 6', 'user'),
    ('APARTAMENT 7', 'user'),
    ('APARTAMENT 8', 'user'),
    ('APARTAMENT 9', 'user'),
    ('APARTAMENT 10', 'user'),
    ('APARTAMENT 11', 'user'),
    ('APARTAMENT 12', 'user'),
    ('APARTAMENT 13', 'user'),
    ('APARTAMENT 14', 'user'),
    ('APARTAMENT 15', 'user'),
    ('APARTAMENT 16', 'user'),
    ('APARTAMENT 17', 'user'),
    ('APARTAMENT 18', 'user'),
    ('AGNIESZKA-111', 'admin'),
    ('ADMIN-111', 'admin')
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE valid_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow read reservations" ON reservations;
DROP POLICY IF EXISTS "Allow insert reservations" ON reservations;
DROP POLICY IF EXISTS "Allow update reservations" ON reservations;
DROP POLICY IF EXISTS "Allow read events" ON events;
DROP POLICY IF EXISTS "Allow insert events" ON events;

-- RESERVATIONS policies
CREATE POLICY "Allow read reservations" ON reservations
    FOR SELECT USING (true);

CREATE POLICY "Allow insert reservations with valid code" ON reservations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM valid_codes WHERE code = user_code AND is_active = true)
    );

CREATE POLICY "Allow update reservations" ON reservations
    FOR UPDATE USING (true)
    WITH CHECK (
        EXISTS (SELECT 1 FROM valid_codes WHERE code = user_code AND is_active = true)
    );

-- EVENTS policies
CREATE POLICY "Allow read events" ON events
    FOR SELECT USING (true);

CREATE POLICY "Allow insert events with valid code" ON events
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM valid_codes WHERE code = user_code AND is_active = true)
    );

-- AUDIT LOG policies (read for admins concept, write for system)
CREATE POLICY "Allow read audit_log" ON audit_log
    FOR SELECT USING (true);

CREATE POLICY "Allow insert audit_log" ON audit_log
    FOR INSERT WITH CHECK (true);

-- APP ERRORS policies
CREATE POLICY "Allow read app_errors" ON app_errors
    FOR SELECT USING (true);

CREATE POLICY "Allow insert app_errors" ON app_errors
    FOR INSERT WITH CHECK (true);

-- VALID CODES policies
CREATE POLICY "Allow read valid_codes" ON valid_codes
    FOR SELECT USING (true);

-- =============================================
-- 5. SERVER-SIDE VALIDATION TRIGGERS
-- =============================================

-- Function to check if slot is available before insert
CREATE OR REPLACE FUNCTION check_slot_available()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if slot is already booked
    IF EXISTS (
        SELECT 1 FROM reservations 
        WHERE date = NEW.date 
        AND hour = NEW.hour 
        AND status = 'active'
        AND id != COALESCE(NEW.id, 0)
    ) THEN
        RAISE EXCEPTION 'SLOT_ALREADY_BOOKED: Ten termin jest już zarezerwowany';
    END IF;
    
    -- Validate user code exists
    IF NOT EXISTS (
        SELECT 1 FROM valid_codes 
        WHERE code = NEW.user_code 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'INVALID_USER_CODE: Nieprawidłowy kod użytkownika';
    END IF;
    
    -- Validate hour range
    IF NEW.hour < 14 OR NEW.hour > 19 THEN
        RAISE EXCEPTION 'INVALID_HOUR: Godzina musi być między 14 a 19';
    END IF;
    
    -- Validate date is not in the past
    IF NEW.date < CURRENT_DATE THEN
        RAISE EXCEPTION 'INVALID_DATE: Nie można rezerwować dat w przeszłości';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for slot validation
DROP TRIGGER IF EXISTS ensure_slot_available ON reservations;
CREATE TRIGGER ensure_slot_available
    BEFORE INSERT ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION check_slot_available();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 6. AUDIT LOG TRIGGERS
-- =============================================

-- Function to log reservation changes
CREATE OR REPLACE FUNCTION log_reservation_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (action, table_name, record_id, user_code, new_data)
        VALUES (
            'INSERT',
            'reservations',
            NEW.id,
            NEW.user_code,
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (action, table_name, record_id, user_code, old_data, new_data)
        VALUES (
            'UPDATE',
            'reservations',
            NEW.id,
            NEW.user_code,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (action, table_name, record_id, user_code, old_data)
        VALUES (
            'DELETE',
            'reservations',
            OLD.id,
            OLD.user_code,
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger for reservations
DROP TRIGGER IF EXISTS audit_reservations ON reservations;
CREATE TRIGGER audit_reservations
    AFTER INSERT OR UPDATE OR DELETE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION log_reservation_changes();

-- =============================================
-- 7. AUTO-CLEANUP FUNCTIONS
-- =============================================

-- Function to clean old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
DECLARE
    deleted_reservations INTEGER;
    deleted_events INTEGER;
    deleted_audit INTEGER;
    deleted_errors INTEGER;
BEGIN
    -- Delete reservations older than 2 years
    DELETE FROM reservations WHERE date < CURRENT_DATE - INTERVAL '2 years';
    GET DIAGNOSTICS deleted_reservations = ROW_COUNT;
    
    -- Delete events older than 2 years
    DELETE FROM events WHERE date < CURRENT_DATE - INTERVAL '2 years';
    GET DIAGNOSTICS deleted_events = ROW_COUNT;
    
    -- Delete audit logs older than 1 year
    DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS deleted_audit = ROW_COUNT;
    
    -- Delete app errors older than 3 months
    DELETE FROM app_errors WHERE created_at < NOW() - INTERVAL '3 months';
    GET DIAGNOSTICS deleted_errors = ROW_COUNT;
    
    -- Log cleanup action
    INSERT INTO audit_log (action, table_name, new_data)
    VALUES (
        'CLEANUP',
        'system',
        jsonb_build_object(
            'deleted_reservations', deleted_reservations,
            'deleted_events', deleted_events,
            'deleted_audit', deleted_audit,
            'deleted_errors', deleted_errors,
            'cleanup_date', NOW()
        )
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 8. SCHEDULED CLEANUP (using pg_cron if available)
-- =============================================

-- Note: pg_cron needs to be enabled in Supabase Dashboard
-- Go to: Database -> Extensions -> Enable pg_cron

-- Uncomment these lines after enabling pg_cron:
-- SELECT cron.schedule(
--     'cleanup-old-data',
--     '0 3 * * 0', -- Every Sunday at 3 AM
--     $$ SELECT cleanup_old_data(); $$
-- );

-- Manual cleanup can be run anytime:
-- SELECT cleanup_old_data();

-- =============================================
-- 9. ENABLE REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE reservations;

-- =============================================
-- 10. HELPER FUNCTIONS
-- =============================================

-- Function to get reservation statistics
CREATE OR REPLACE FUNCTION get_reservation_stats(
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
    total_reservations BIGINT,
    total_cancellations BIGINT,
    most_active_apartment VARCHAR,
    busiest_hour INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) FILTER (WHERE status = 'active') as active_count,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count
        FROM reservations
        WHERE (p_date_from IS NULL OR date >= p_date_from)
        AND (p_date_to IS NULL OR date <= p_date_to)
    ),
    top_apartment AS (
        SELECT user_code, COUNT(*) as cnt
        FROM reservations
        WHERE status = 'active'
        AND (p_date_from IS NULL OR date >= p_date_from)
        AND (p_date_to IS NULL OR date <= p_date_to)
        GROUP BY user_code
        ORDER BY cnt DESC
        LIMIT 1
    ),
    top_hour AS (
        SELECT hour, COUNT(*) as cnt
        FROM reservations
        WHERE status = 'active'
        AND (p_date_from IS NULL OR date >= p_date_from)
        AND (p_date_to IS NULL OR date <= p_date_to)
        GROUP BY hour
        ORDER BY cnt DESC
        LIMIT 1
    )
    SELECT 
        s.active_count,
        s.cancelled_count,
        ta.user_code,
        th.hour
    FROM stats s
    LEFT JOIN top_apartment ta ON true
    LEFT JOIN top_hour th ON true;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- UPGRADE FROM V1 (if you have existing data)
-- =============================================

-- Run these only if upgrading from v1:

-- Add new columns to reservations if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'created_by') THEN
        ALTER TABLE reservations ADD COLUMN created_by VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'cancelled_by') THEN
        ALTER TABLE reservations ADD COLUMN cancelled_by VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'cancelled_at') THEN
        ALTER TABLE reservations ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
END $$;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Check all tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check triggers:
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers WHERE trigger_schema = 'public';

-- Check valid codes:
-- SELECT * FROM valid_codes;

-- Run manual cleanup:
-- SELECT cleanup_old_data();

-- Get stats:
-- SELECT * FROM get_reservation_stats();
-- SELECT * FROM get_reservation_stats('2024-01-01', '2024-12-31');
