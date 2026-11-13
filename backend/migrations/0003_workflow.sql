ALTER TABLE service_visits DROP CONSTRAINT service_visits_stage_check;
ALTER TABLE service_visits ADD CONSTRAINT service_visits_stage_check CHECK(stage IN ('RECEIVED','INSPECTED','IN_PROGRESS','QUALITY_CHECK','READY','HANDED_OVER','ABORTED'));
ALTER TABLE service_visits ADD COLUMN ready_at timestamptz;
ALTER TABLE service_visits ADD COLUMN handed_over_at timestamptz;
ALTER TABLE service_visits ADD COLUMN aborted_at timestamptz;
DROP INDEX vehicle_open_visit;
CREATE UNIQUE INDEX vehicle_open_visit ON service_visits(station_id,vehicle_id) WHERE stage NOT IN ('HANDED_OVER','ABORTED');

CREATE TABLE quote_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL REFERENCES service_visits,
 revision_no integer NOT NULL CHECK(revision_no>0), kind text NOT NULL CHECK(kind IN ('INITIAL','CHANGE_ORDER')),
 base_revision_id uuid REFERENCES quote_revisions, status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
 currency text NOT NULL DEFAULT 'VND' CHECK(currency='VND'), calculation_policy text NOT NULL DEFAULT 'VND_LINE_HALF_UP_V1' CHECK(calculation_policy='VND_LINE_HALF_UP_V1'),
 discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 100),
 subtotal numeric(18,0) NOT NULL DEFAULT 0, discount_total numeric(18,0) NOT NULL DEFAULT 0,
 tax_total numeric(18,0) NOT NULL DEFAULT 0, total numeric(18,0) NOT NULL DEFAULT 0,
 note text NOT NULL DEFAULT '', print_snapshot jsonb, created_by uuid NOT NULL REFERENCES users,
 created_at timestamptz NOT NULL, submitted_at timestamptz, decided_at timestamptz,
 UNIQUE(visit_id,revision_no), CHECK(total=subtotal-discount_total+tax_total), CHECK(total>=0 AND discount_total>=0 AND discount_total<=subtotal AND tax_total>=0)
);
CREATE UNIQUE INDEX quote_one_open_revision ON quote_revisions(visit_id) WHERE status IN ('DRAFT','SUBMITTED');
CREATE INDEX quote_status_list ON quote_revisions(status,created_at,id);
CREATE TABLE quote_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES quote_revisions,
 sequence_no integer NOT NULL, kind text NOT NULL CHECK(kind IN ('SERVICE','PART')),
 service_id uuid REFERENCES services, resource_plan jsonb, name varchar(160) NOT NULL, code varchar(60) NOT NULL DEFAULT '', unit varchar(30) NOT NULL,
 quantity numeric(10,3) NOT NULL CHECK(quantity>0), unit_price numeric(15,0) NOT NULL CHECK(unit_price>=0),
 discount_percent numeric(5,2) NOT NULL CHECK(discount_percent BETWEEN 0 AND 100), vat_percent numeric(5,2) NOT NULL CHECK(vat_percent BETWEEN 0 AND 100),
 subtotal numeric(18,0) NOT NULL, discount_total numeric(18,0) NOT NULL, tax_total numeric(18,0) NOT NULL, total numeric(18,0) NOT NULL,
 UNIQUE(revision_id,sequence_no), CHECK(total=subtotal-discount_total+tax_total AND total>=0 AND discount_total>=0 AND discount_total<=subtotal AND tax_total>=0)
);
CREATE TABLE quote_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL UNIQUE REFERENCES quote_revisions,
 decision text NOT NULL CHECK(decision IN ('APPROVED','REJECTED')), recorded_by uuid NOT NULL REFERENCES users,
 recorded_at timestamptz NOT NULL, customer_name text NOT NULL, channel text NOT NULL CHECK(channel IN ('PHONE','ZALO','IN_PERSON','OTHER')),
 evidence_note text NOT NULL, media_id uuid REFERENCES visit_media
);
CREATE TABLE work_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL UNIQUE REFERENCES service_visits,
 status text NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED','IN_PROGRESS','PAUSED','FINISHED','ABORTED')),
 scope_version integer NOT NULL DEFAULT 1 CHECK(scope_version>0), started_at timestamptz, finished_at timestamptz,
 due_at timestamptz, note text NOT NULL DEFAULT ''
);
CREATE TABLE work_exemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL REFERENCES service_visits,
 mode text NOT NULL CHECK(mode IN ('NO_QUOTE_FREE','FREE_TASKS')), scope text NOT NULL, reason text NOT NULL,
 evidence jsonb NOT NULL, approved_by uuid NOT NULL REFERENCES users, approved_at timestamptz NOT NULL
);
CREATE TABLE work_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), work_order_id uuid NOT NULL REFERENCES work_orders,
 quote_line_id uuid REFERENCES quote_lines, exemption_id uuid REFERENCES work_exemptions,
 label varchar(200) NOT NULL, status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','IN_PROGRESS','DONE','SKIPPED')),
 due_at timestamptz NOT NULL, started_at timestamptz, finished_at timestamptz,
 CHECK(quote_line_id IS NULL OR exemption_id IS NULL)
);
CREATE INDEX work_items_order ON work_items(work_order_id,id);
CREATE TABLE work_item_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), work_item_id uuid NOT NULL REFERENCES work_items,
 technician_id uuid NOT NULL REFERENCES staff_profiles, assigned_by uuid NOT NULL REFERENCES users,
 assigned_at timestamptz NOT NULL, ended_at timestamptz, reason text NOT NULL
);
CREATE UNIQUE INDEX work_item_current_technician ON work_item_assignments(work_item_id,technician_id) WHERE ended_at IS NULL;
CREATE TABLE work_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), work_order_id uuid NOT NULL REFERENCES work_orders,
 actor_user_id uuid NOT NULL REFERENCES users, occurred_at timestamptz NOT NULL, type text NOT NULL, note text NOT NULL,
 work_item_id uuid REFERENCES work_items
);
CREATE TABLE acceptances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL REFERENCES service_visits,
 work_order_id uuid NOT NULL REFERENCES work_orders, scope_version integer NOT NULL,
 result text NOT NULL CHECK(result IN ('PASSED','NEEDS_WORK')), inspector_id uuid NOT NULL REFERENCES staff_profiles,
 recorded_by uuid NOT NULL REFERENCES users, checked_at timestamptz NOT NULL, note text NOT NULL, print_snapshot jsonb NOT NULL
);
CREATE INDEX visit_acceptance_history ON acceptances(visit_id,checked_at,id);
CREATE TABLE acceptance_checks (
 acceptance_id uuid NOT NULL REFERENCES acceptances, work_item_id uuid NOT NULL REFERENCES work_items,
 label_snapshot text NOT NULL, passed boolean NOT NULL, note text NOT NULL DEFAULT '', PRIMARY KEY(acceptance_id,work_item_id)
);
CREATE TABLE visit_handovers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL UNIQUE REFERENCES service_visits,
 acceptance_id uuid NOT NULL REFERENCES acceptances, handed_over_by uuid NOT NULL REFERENCES users, handed_over_at timestamptz NOT NULL,
 recipient_name text NOT NULL, evidence_note text NOT NULL,
 payment_basis text NOT NULL CHECK(payment_basis='NO_CHARGE'),
 approved_obligation numeric(18,0) NOT NULL CHECK(approved_obligation=0)
);
CREATE TABLE resource_occupancies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL REFERENCES service_visits,
 resource_id uuid NOT NULL REFERENCES resource_units, started_at timestamptz NOT NULL,
 expected_release_at timestamptz NOT NULL, ended_at timestamptz,
 recorded_by uuid NOT NULL REFERENCES users, release_reason text, CHECK(ended_at IS NULL OR ended_at>=started_at),
 EXCLUDE USING gist(resource_id WITH =,tstzrange(started_at,ended_at,'[)') WITH &&)
);
CREATE UNIQUE INDEX current_resource_occupancy ON resource_occupancies(resource_id) WHERE ended_at IS NULL;
CREATE INDEX visit_resource_occupancy ON resource_occupancies(visit_id,ended_at);

CREATE FUNCTION protect_quote_revision() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
  IF TG_OP='DELETE' AND OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'Quote revision is immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND OLD.status<>'DRAFT' AND
    ((to_jsonb(NEW)-'status'-'decided_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'decided_at') OR
     OLD.status<>'SUBMITTED' OR NEW.status NOT IN ('APPROVED','REJECTED'))
    THEN RAISE EXCEPTION 'Quote revision is immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END;
$$;
CREATE TRIGGER protect_quote BEFORE UPDATE OR DELETE ON quote_revisions FOR EACH ROW EXECUTE FUNCTION protect_quote_revision();
CREATE FUNCTION protect_quote_line() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE revision_status text;
 BEGIN
  SELECT status INTO revision_status FROM quote_revisions WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.revision_id ELSE NEW.revision_id END;
  IF revision_status<>'DRAFT' THEN RAISE EXCEPTION 'Quote lines are immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND OLD.revision_id<>NEW.revision_id THEN RAISE EXCEPTION 'Quote line revision cannot change' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END;
$$;
CREATE TRIGGER protect_quote_lines BEFORE INSERT OR UPDATE OR DELETE ON quote_lines FOR EACH ROW EXECUTE FUNCTION protect_quote_line();
CREATE TRIGGER immutable_quote_decisions BEFORE UPDATE OR DELETE ON quote_decisions FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_exemptions BEFORE UPDATE OR DELETE ON work_exemptions FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_work_logs BEFORE UPDATE OR DELETE ON work_logs FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_acceptances BEFORE UPDATE OR DELETE ON acceptances FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_acceptance_checks BEFORE UPDATE OR DELETE ON acceptance_checks FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_handovers BEFORE UPDATE OR DELETE ON visit_handovers FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
