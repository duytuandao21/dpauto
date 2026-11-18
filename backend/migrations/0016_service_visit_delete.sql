ALTER TABLE service_visits ADD COLUMN deleted_at timestamptz;
ALTER TABLE service_visits ADD COLUMN deleted_by uuid REFERENCES users;
ALTER TABLE service_visits ADD CONSTRAINT service_visit_deleted_valid CHECK(
 (deleted_at IS NULL)=(deleted_by IS NULL) AND (deleted_at IS NULL OR stage='ABORTED')
);
