ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_code_check;
ALTER TABLE user_roles ADD CHECK(role_code IN ('MANAGER','ADVISOR','CMS_ADMIN'));
ALTER TABLE user_permission_grants DROP CONSTRAINT user_permission_grants_permission_code_check;
ALTER TABLE user_permission_grants ADD CHECK(permission_code IN ('staff.manage','roles.manage','inventory.manage','inventory.adjust','inventory.cost.read','finance.read','payments.collect','payments.refund','reports.export','cms.read','cms.write','cms.publish','notifications.manage'));

CREATE TABLE staff_shifts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations,
 staff_id uuid NOT NULL REFERENCES staff_profiles, kind text NOT NULL CHECK(kind IN ('WORK','LEAVE')),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, note varchar(400) NOT NULL,
 version integer NOT NULL DEFAULT 1, created_by uuid NOT NULL REFERENCES users, canceled_at timestamptz,
 CHECK(ends_at>starts_at AND ends_at-starts_at<=interval '24 hours'),
 EXCLUDE USING gist(staff_id WITH =,kind WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(canceled_at IS NULL)
);
CREATE INDEX shifts_station_time ON staff_shifts(station_id,starts_at,id) WHERE canceled_at IS NULL;

CREATE TABLE cms_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations,
 created_at timestamptz NOT NULL, created_by uuid NOT NULL REFERENCES users,
 name varchar(120) NOT NULL, alt varchar(240) NOT NULL, content bytea NOT NULL,
 sha256 text NOT NULL, CHECK(octet_length(content) BETWEEN 4 AND 204800)
);
CREATE TABLE cms_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations,
 kind text NOT NULL CHECK(kind IN ('NEWS','PAGE','SEO')), key varchar(180) NOT NULL,
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL,
 published_revision_id uuid, withdrawn boolean NOT NULL DEFAULT false,
 UNIQUE(station_id,kind,key)
);
CREATE TABLE cms_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES cms_documents,
 revision_no integer NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL,
 created_by uuid NOT NULL REFERENCES users, UNIQUE(document_id,revision_no), UNIQUE(document_id,id)
);
ALTER TABLE cms_documents ADD FOREIGN KEY(id,published_revision_id) REFERENCES cms_revisions(document_id,id);
CREATE TABLE cms_revision_assets (
 revision_id uuid NOT NULL REFERENCES cms_revisions, asset_id uuid NOT NULL REFERENCES cms_assets,
 PRIMARY KEY(revision_id,asset_id)
);
CREATE INDEX cms_asset_references ON cms_revision_assets(asset_id,revision_id);
CREATE TRIGGER immutable_cms_revisions BEFORE UPDATE OR DELETE ON cms_revisions FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_cms_revision_assets BEFORE UPDATE OR DELETE ON cms_revision_assets FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();

ALTER TABLE outbox_jobs DROP CONSTRAINT outbox_jobs_status_check;
ALTER TABLE outbox_jobs ADD CHECK(status IN ('PENDING','PROCESSING','PROCESSED','SENT','FAILED'));
ALTER TABLE outbox_jobs ADD COLUMN lease_token uuid;
CREATE TABLE notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES stations,
 recipient_id uuid NOT NULL REFERENCES users, event_key text NOT NULL,
 subject_type text NOT NULL CHECK(subject_type IN ('booking','visit')), subject_id uuid NOT NULL,
 title varchar(200) NOT NULL, created_at timestamptz NOT NULL, read_at timestamptz,
 version integer NOT NULL DEFAULT 1, UNIQUE(recipient_id,event_key)
);
CREATE INDEX inbox_recipient_time ON notifications(recipient_id,created_at,id);
CREATE TABLE notification_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES outbox_jobs,
 attempt integer NOT NULL, channel text NOT NULL CHECK(channel IN ('INBOX','ZALO')),
 status text NOT NULL CHECK(status IN ('PROCESSED','BLOCKED','FAILED')),
 error_code text, occurred_at timestamptz NOT NULL, UNIQUE(job_id,attempt,channel)
);
CREATE TRIGGER immutable_notification_deliveries BEFORE UPDATE OR DELETE ON notification_deliveries FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
