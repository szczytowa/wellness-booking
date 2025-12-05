-- ============================================================
-- MIGRACJA - POWIADOMIENIA EMAIL
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- 1. Dodaj kolumnę reminder_sent do rezerwacji
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reminder_sent TIMESTAMPTZ;

-- 2. Utwórz funkcję do wywoływania Edge Function przy nowej rezerwacji
CREATE OR REPLACE FUNCTION notify_new_reservation()
RETURNS TRIGGER AS $$
DECLARE
  payload json;
  notification_type text;
BEGIN
  -- Określ typ powiadomienia
  IF NEW.created_by IS NOT NULL THEN
    notification_type := 'admin_booking';
  ELSE
    notification_type := 'new_reservation';
  END IF;

  -- Przygotuj payload
  payload := json_build_object(
    'type', notification_type,
    'reservation', json_build_object(
      'id', NEW.id,
      'user_code', NEW.user_code,
      'date', NEW.date,
      'hour', NEW.hour,
      'note', NEW.note,
      'created_by', NEW.created_by
    )
  );

  -- Wywołaj Edge Function (async via pg_net)
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )::jsonb,
    body := payload::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Utwórz funkcję do wywoływania Edge Function przy anulowaniu
CREATE OR REPLACE FUNCTION notify_cancellation()
RETURNS TRIGGER AS $$
DECLARE
  payload json;
  notification_type text;
BEGIN
  -- Tylko gdy status zmienia się na 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status = 'active' THEN
    -- Określ typ powiadomienia
    IF NEW.cancelled_by IS NOT NULL THEN
      notification_type := 'admin_cancel';
    ELSE
      notification_type := 'cancellation';
    END IF;

    -- Przygotuj payload
    payload := json_build_object(
      'type', notification_type,
      'reservation', json_build_object(
        'id', NEW.id,
        'user_code', NEW.user_code,
        'date', NEW.date,
        'hour', NEW.hour,
        'created_by', NEW.cancelled_by
      )
    );

    -- Wywołaj Edge Function
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )::jsonb,
      body := payload::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Utwórz triggery
DROP TRIGGER IF EXISTS trigger_notify_new_reservation ON reservations;
CREATE TRIGGER trigger_notify_new_reservation
  AFTER INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_reservation();

DROP TRIGGER IF EXISTS trigger_notify_cancellation ON reservations;
CREATE TRIGGER trigger_notify_cancellation
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION notify_cancellation();

-- ============================================================
-- UWAGA: Powyższe triggery używają pg_net (HTTP extension)
-- Jeśli pg_net nie jest włączony, użyj alternatywnej metody
-- z Database Webhooks w panelu Supabase (patrz instrukcja)
-- ============================================================
