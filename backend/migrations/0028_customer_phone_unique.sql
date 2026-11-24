-- One active customer per phone: merge existing duplicates into the oldest record, then enforce it.
ALTER TABLE customers ADD COLUMN deleted_at timestamptz;
ALTER TABLE customers ADD COLUMN deleted_by uuid REFERENCES users;
ALTER TABLE customers ADD CONSTRAINT customer_deleted_valid CHECK((deleted_at IS NULL)=(deleted_by IS NULL));

CREATE TEMP TABLE customer_phone_merge ON COMMIT DROP AS
SELECT id AS source_id, first_value(id) OVER w AS target_id
FROM customers
WHERE merged_into_id IS NULL
WINDOW w AS (PARTITION BY phone_normalized ORDER BY created_at, id);
DELETE FROM customer_phone_merge WHERE source_id = target_id;

UPDATE bookings t SET customer_id = m.target_id FROM customer_phone_merge m WHERE t.customer_id = m.source_id;
UPDATE service_visits t SET customer_id = m.target_id FROM customer_phone_merge m WHERE t.customer_id = m.source_id;
UPDATE legacy_identities t SET customer_id = m.target_id FROM customer_phone_merge m WHERE t.customer_id = m.source_id;
-- Imported legacy rows are immutable; their history stays reachable through the merged record.
UPDATE legacy_records t SET customer_id = m.target_id FROM customer_phone_merge m
 WHERE t.customer_id = m.source_id AND t.status NOT IN ('IMPORTED','SKIPPED');
-- Same vehicle on both records: end the duplicate link; other vehicles move to the kept customer.
UPDATE customer_vehicle_links l SET valid_to = GREATEST(now(), l.valid_from + interval '1 millisecond')
 FROM customer_phone_merge m
 WHERE l.customer_id = m.source_id AND l.valid_to IS NULL AND EXISTS(
  SELECT 1 FROM customer_vehicle_links k WHERE k.customer_id = m.target_id AND k.vehicle_id = l.vehicle_id
   AND k.relationship = l.relationship AND k.valid_to IS NULL);
UPDATE customer_vehicle_links l SET customer_id = m.target_id
 FROM customer_phone_merge m WHERE l.customer_id = m.source_id AND l.valid_to IS NULL;
UPDATE customers c SET merged_into_id = m.target_id, merged_at = now(), version = version + 1, updated_at = now()
 FROM customer_phone_merge m WHERE c.id = m.source_id;

CREATE UNIQUE INDEX customers_phone_unique ON customers(phone_normalized)
 WHERE merged_into_id IS NULL AND deleted_at IS NULL;
