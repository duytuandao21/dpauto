CREATE TABLE station_write_guards (
 station_id uuid PRIMARY KEY REFERENCES stations, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 frozen boolean NOT NULL DEFAULT false, reason text NOT NULL, changed_at timestamptz NOT NULL,
 changed_by uuid NOT NULL REFERENCES users
);
CREATE TABLE legacy_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations,
 source_system varchar(80) NOT NULL, file_sha256 text NOT NULL, scope_mode text NOT NULL CHECK(scope_mode IN ('REFERENCE_ONLY','CUTOVER')), exported_at timestamptz NOT NULL, cutoff_at timestamptz NOT NULL,
 expected jsonb NOT NULL, validation jsonb NOT NULL, version integer NOT NULL DEFAULT 1,
 status text NOT NULL CHECK(status IN ('STAGED','IMPORTED','ABANDONED')), created_at timestamptz NOT NULL,
 created_by uuid NOT NULL REFERENCES users, imported_at timestamptz,
 UNIQUE(station_id,source_system,file_sha256)
);
CREATE TABLE legacy_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES legacy_batches,
 row_no integer NOT NULL, entity_type varchar(40) NOT NULL, external_id varchar(200) NOT NULL,
 source_version varchar(100) NOT NULL, checksum text NOT NULL, payload jsonb, errors jsonb NOT NULL,
 decision text CHECK(decision IN ('CREATE','LINK','ARCHIVE','KEEP_LEGACY')), review jsonb,
 reviewed_by uuid REFERENCES users, reviewed_at timestamptz, reason text,
 status text NOT NULL CHECK(status IN ('STAGED','QUARANTINED','IMPORTED','SKIPPED')),
 customer_id uuid REFERENCES customers, vehicle_id uuid REFERENCES vehicles,
 media_content bytea CHECK(media_content IS NULL OR octet_length(media_content)<=10485760),
 UNIQUE(batch_id,row_no)
);
CREATE INDEX legacy_customer_history ON legacy_records(customer_id,entity_type,id) WHERE status='IMPORTED';
CREATE INDEX legacy_vehicle_history ON legacy_records(vehicle_id,entity_type,id) WHERE status='IMPORTED';
CREATE TABLE legacy_identities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations,
 source_system varchar(80) NOT NULL, entity_type varchar(40) NOT NULL, external_id varchar(200) NOT NULL,
 source_version varchar(100) NOT NULL, checksum text NOT NULL, current_record_id uuid NOT NULL REFERENCES legacy_records,
 customer_id uuid REFERENCES customers, vehicle_id uuid REFERENCES vehicles,
 stock_line_id uuid REFERENCES stock_document_lines, cash_id uuid REFERENCES cash_entries, visit_id uuid REFERENCES service_visits,
 ownership text NOT NULL CHECK(ownership IN ('ARCHIVE','LEGACY','DPAUTO')),
 UNIQUE(station_id,source_system,entity_type,external_id)
);
CREATE UNIQUE INDEX legacy_stock_proof ON legacy_identities(stock_line_id) WHERE stock_line_id IS NOT NULL;
CREATE UNIQUE INDEX legacy_cash_proof ON legacy_identities(cash_id) WHERE cash_id IS NOT NULL;
CREATE UNIQUE INDEX legacy_visit_proof ON legacy_identities(entity_type,visit_id) WHERE visit_id IS NOT NULL;
CREATE TABLE ops_checkpoints (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations,
 created_at timestamptz NOT NULL, created_by uuid NOT NULL REFERENCES users, reason text NOT NULL,
 fingerprint text NOT NULL, snapshot jsonb NOT NULL
);
CREATE TABLE ops_cutovers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations,
 checkpoint_id uuid NOT NULL UNIQUE REFERENCES ops_checkpoints,
 mode text NOT NULL CHECK(mode IN ('NEW_BUSINESS','FULL')), restore_proof_sha256 text NOT NULL,
 approved_by uuid NOT NULL REFERENCES users, approved_at timestamptz NOT NULL, reason text NOT NULL,
 training_confirmed boolean NOT NULL CHECK(training_confirmed), source_freeze_confirmed boolean NOT NULL
);
CREATE FUNCTION protect_imported_record() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
  IF OLD.status IN ('IMPORTED','SKIPPED') THEN RAISE EXCEPTION 'Imported history is immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END;
$$;
CREATE TRIGGER immutable_legacy_records BEFORE UPDATE OR DELETE ON legacy_records FOR EACH ROW EXECUTE FUNCTION protect_imported_record();
CREATE TRIGGER immutable_ops_checkpoints BEFORE UPDATE OR DELETE ON ops_checkpoints FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_ops_cutovers BEFORE UPDATE OR DELETE ON ops_cutovers FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
