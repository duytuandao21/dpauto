ALTER TABLE bookings ADD COLUMN deleted_at timestamptz;
ALTER TABLE bookings ADD COLUMN deleted_by uuid REFERENCES users;
ALTER TABLE bookings ADD CONSTRAINT booking_deleted_valid CHECK((deleted_at IS NULL)=(deleted_by IS NULL));
