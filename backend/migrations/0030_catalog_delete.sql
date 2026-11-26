-- Soft delete for catalog records: hidden from management lists, old bookings and tickets keep their links.
ALTER TABLE services ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid REFERENCES users,
 ADD CONSTRAINT service_deleted_valid CHECK((deleted_at IS NULL)=(deleted_by IS NULL));
ALTER TABLE staff_profiles ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid REFERENCES users,
 ADD CONSTRAINT staff_deleted_valid CHECK((deleted_at IS NULL)=(deleted_by IS NULL));
ALTER TABLE partners ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid REFERENCES users,
 ADD CONSTRAINT partner_deleted_valid CHECK((deleted_at IS NULL)=(deleted_by IS NULL));
ALTER TABLE partner_sales ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid REFERENCES users,
 ADD CONSTRAINT partner_sale_deleted_valid CHECK((deleted_at IS NULL)=(deleted_by IS NULL));
ALTER TABLE parts ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid REFERENCES users,
 ADD CONSTRAINT part_deleted_valid CHECK((deleted_at IS NULL)=(deleted_by IS NULL));
ALTER TABLE warehouses ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid REFERENCES users,
 ADD CONSTRAINT warehouse_deleted_valid CHECK((deleted_at IS NULL)=(deleted_by IS NULL));
ALTER TABLE vehicles ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid REFERENCES users,
 ADD CONSTRAINT vehicle_deleted_valid CHECK((deleted_at IS NULL)=(deleted_by IS NULL));
-- Only drafts can be deleted; posted documents are ledger history.
ALTER TABLE stock_documents ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid REFERENCES users,
 ADD CONSTRAINT stock_document_deleted_valid CHECK((deleted_at IS NULL)=(deleted_by IS NULL) AND (deleted_at IS NULL OR status='DRAFT'));
