ALTER TABLE bookings ADD COLUMN original_requested_period text
  CHECK (original_requested_period IN ('MORNING','AFTERNOON'));
UPDATE bookings SET original_requested_period=requested_period;
