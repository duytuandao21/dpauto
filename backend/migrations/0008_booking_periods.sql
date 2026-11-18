-- Customers request a day and a half-day period; advisors set the exact time when confirming.
-- NULL for staff-created bookings and bookings created before this change (they carry an exact time).
ALTER TABLE bookings
  ADD COLUMN requested_period text CHECK (requested_period IN ('MORNING','AFTERNOON'));
