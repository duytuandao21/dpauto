-- A merged customer keeps its immutable history (consents, cash entries) and points at the kept record.
ALTER TABLE customers
  ADD COLUMN merged_into_id uuid REFERENCES customers,
  ADD COLUMN merged_at timestamptz,
  ADD CONSTRAINT customers_merge_shape CHECK (
    (merged_into_id IS NULL) = (merged_at IS NULL) AND merged_into_id IS DISTINCT FROM id
  );
CREATE INDEX customers_active_name ON customers(normalized_name, id) WHERE merged_into_id IS NULL;
