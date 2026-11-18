ALTER TABLE service_visits ADD COLUMN workflow_version integer NOT NULL DEFAULT 1 CHECK(workflow_version IN (1,2));
ALTER TABLE service_visits ADD COLUMN is_paused boolean NOT NULL DEFAULT false;
ALTER TABLE service_visits ADD COLUMN pause_reason text;
ALTER TABLE service_visits ADD COLUMN paused_at timestamptz;
ALTER TABLE service_visits ADD CONSTRAINT visit_pause_valid CHECK(NOT is_paused OR (stage='IN_PROGRESS' AND pause_reason IS NOT NULL AND paused_at IS NOT NULL));
ALTER TABLE service_visits DROP CONSTRAINT service_visits_stage_check;
ALTER TABLE service_visits ADD CONSTRAINT service_visits_stage_check CHECK(
 (workflow_version=1 AND stage IN ('RECEIVED','INSPECTED','IN_PROGRESS','QUALITY_CHECK','READY','HANDED_OVER','ABORTED')) OR
 (workflow_version=2 AND stage IN ('QUOTING','WAITING_FOR_WORK','IN_PROGRESS','HANDOVER','COMPLETED','ABORTED')));
DROP INDEX vehicle_open_visit;
CREATE UNIQUE INDEX vehicle_open_visit ON service_visits(station_id,vehicle_id) WHERE stage NOT IN ('HANDED_OVER','COMPLETED','ABORTED');

ALTER TABLE services ADD COLUMN quality_checks jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(quality_checks)='array');
ALTER TABLE services ADD COLUMN technician_required boolean NOT NULL DEFAULT false;
UPDATE services s SET quality_checks=CASE c.code
 WHEN 'MAINTENANCE' THEN '["Kiểm tra các hạng mục bảo dưỡng và an toàn vận hành"]'::jsonb
 WHEN 'DETAILING' THEN '["Kiểm tra bề mặt và chất lượng hoàn thiện"]'::jsonb
 WHEN 'ACCESSORIES' THEN '["Kiểm tra lắp đặt và vận hành phụ kiện"]'::jsonb
 ELSE '[]'::jsonb END FROM service_categories c WHERE c.id=s.category_id;
ALTER TABLE quote_lines ADD COLUMN workflow_requirements jsonb NOT NULL DEFAULT '{"qualityChecks":[],"technicianRequired":false}';
ALTER TABLE quote_revisions ADD COLUMN approved_total numeric(18,0) CHECK(approved_total>=0 AND approved_total<=total);
ALTER TABLE quote_revisions DROP CONSTRAINT quote_revisions_status_check;
ALTER TABLE quote_revisions ADD CONSTRAINT quote_revisions_status_check CHECK(status IN ('DRAFT','SUBMITTED','PENDING_APPROVAL','APPROVED','REJECTED','VOIDED'));
ALTER TABLE quote_decisions ADD COLUMN approved_line_ids uuid[];
DROP INDEX quote_one_open_revision;
CREATE UNIQUE INDEX quote_one_open_revision ON quote_revisions(visit_id) WHERE status IN ('DRAFT','SUBMITTED','PENDING_APPROVAL');
ALTER TABLE acceptances ADD COLUMN quality_checks jsonb NOT NULL DEFAULT '[]';
ALTER TABLE acceptances ADD COLUMN completion_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE acceptances ADD COLUMN record_no bigint GENERATED ALWAYS AS IDENTITY;

CREATE OR REPLACE FUNCTION protect_quote_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'Quote revision is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND OLD.status<>'DRAFT' AND
  ((to_jsonb(NEW)-'status'-'decided_at'-'approved_total') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'decided_at'-'approved_total') OR
   NOT ((OLD.status IN ('SUBMITTED','PENDING_APPROVAL') AND NEW.status IN ('APPROVED','REJECTED')) OR
        (OLD.status IN ('SUBMITTED','PENDING_APPROVAL','APPROVED') AND NEW.status='VOIDED' AND NEW.approved_total IS NOT DISTINCT FROM OLD.approved_total)) OR
   (OLD.status='APPROVED' AND NEW.decided_at IS DISTINCT FROM OLD.decided_at))
 THEN RAISE EXCEPTION 'Quote revision is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;

CREATE VIEW authorized_quote_lines AS
SELECT l.*,r.visit_id FROM quote_lines l JOIN quote_revisions r ON r.id=l.revision_id
WHERE r.status='APPROVED' AND NOT EXISTS(
 SELECT 1 FROM quote_decisions d WHERE d.revision_id=r.id AND d.approved_line_ids IS NOT NULL AND NOT(l.id=ANY(d.approved_line_ids)));
