-- Partner units (e.g. Xe Lướt Toàn Trung) and their sales staff who bring cars to the station.
CREATE TABLE partners (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations,
 name varchar(120) NOT NULL, phone_normalized varchar(20), active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE partner_sales (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_id uuid NOT NULL REFERENCES partners,
 name varchar(100) NOT NULL, phone_normalized varchar(20), active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_sales_by_partner ON partner_sales(partner_id, name);
-- Snapshot keeps the names used at the time, so renaming a sale never rewrites old tickets.
ALTER TABLE bookings ADD COLUMN partner_sale_id uuid REFERENCES partner_sales, ADD COLUMN partner_snapshot jsonb;
ALTER TABLE service_visits ADD COLUMN partner_sale_id uuid REFERENCES partner_sales, ADD COLUMN partner_snapshot jsonb;
CREATE INDEX visits_by_partner ON service_visits(station_id, received_at) WHERE partner_sale_id IS NOT NULL;
INSERT INTO partners(station_id, name) SELECT id, 'Xe Lướt Toàn Trung' FROM stations;
