CREATE TABLE service_visits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 station_id uuid NOT NULL REFERENCES stations, booking_id uuid UNIQUE REFERENCES bookings,
 customer_id uuid NOT NULL REFERENCES customers, vehicle_id uuid NOT NULL REFERENCES vehicles,
 assigned_advisor_id uuid NOT NULL REFERENCES staff_profiles, origin text NOT NULL CHECK(origin IN ('BOOKING','WALK_IN')),
 stage text NOT NULL DEFAULT 'RECEIVED' CHECK(stage IN ('RECEIVED','INSPECTED','HANDED_OVER','ABORTED')),
 received_at timestamptz NOT NULL, received_by uuid NOT NULL REFERENCES users,
 contact_snapshot jsonb NOT NULL, vehicle_snapshot jsonb NOT NULL,
 request text NOT NULL CHECK(length(request) BETWEEN 1 AND 2000),
 odometer integer CHECK(odometer BETWEEN 0 AND 9999999), odometer_missing_reason text,
 plate_missing_reason text, conditions jsonb NOT NULL, reception_note text NOT NULL DEFAULT '',
 follow_up_of_visit_id uuid REFERENCES service_visits, follow_up_reason text,
 CHECK((origin='BOOKING')=(booking_id IS NOT NULL)),
 CHECK(odometer IS NOT NULL OR COALESCE(length(odometer_missing_reason),0)>0),
 CHECK(follow_up_of_visit_id IS NULL OR (follow_up_of_visit_id<>id AND COALESCE(length(follow_up_reason),0)>0))
);
CREATE UNIQUE INDEX vehicle_open_visit ON service_visits(station_id,vehicle_id) WHERE stage IN ('RECEIVED','INSPECTED');
CREATE INDEX visit_station_time ON service_visits(station_id,received_at,id);
CREATE INDEX visit_owner_time ON service_visits(assigned_advisor_id,received_at,id);
CREATE INDEX visit_customer_history ON service_visits(customer_id,received_at,id);
CREATE INDEX visit_vehicle_history ON service_visits(vehicle_id,received_at,id);
CREATE TABLE visit_services (
 visit_id uuid NOT NULL REFERENCES service_visits, service_id uuid NOT NULL REFERENCES services,
 sequence_no integer NOT NULL, service_name_snapshot text NOT NULL, plan_revision integer NOT NULL,
 plan_snapshot jsonb NOT NULL, PRIMARY KEY(visit_id,service_id), UNIQUE(visit_id,sequence_no)
);
CREATE TABLE visit_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL REFERENCES service_visits,
 advisor_id uuid NOT NULL REFERENCES staff_profiles, assigned_by uuid NOT NULL REFERENCES users,
 assigned_at timestamptz NOT NULL, ended_at timestamptz, reason text NOT NULL, historical_snapshot jsonb,
 CHECK(ended_at IS NULL OR ended_at>assigned_at)
);
CREATE UNIQUE INDEX current_visit_advisor ON visit_assignments(visit_id) WHERE ended_at IS NULL;
CREATE INDEX visit_assignment_history ON visit_assignments(advisor_id,assigned_at,id);
CREATE TABLE visit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL REFERENCES service_visits,
 actor_user_id uuid NOT NULL REFERENCES users, type text NOT NULL, occurred_at timestamptz NOT NULL,
 reason text, data jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX visit_event_timeline ON visit_events(visit_id,occurred_at,id);
CREATE TRIGGER immutable_visit_events BEFORE UPDATE OR DELETE ON visit_events FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TABLE visit_contact_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL REFERENCES service_visits,
 actor_user_id uuid NOT NULL REFERENCES users, contacted_at timestamptz NOT NULL,
 channel text NOT NULL CHECK(channel IN ('PHONE','ZALO','IN_PERSON','OTHER')),
 outcome text NOT NULL CHECK(outcome IN ('UNREACHED','AGREED','DECLINED','OTHER')), note_internal text NOT NULL DEFAULT ''
);
CREATE INDEX visit_contact_timeline ON visit_contact_events(visit_id,contacted_at,id);
CREATE TRIGGER immutable_visit_contacts BEFORE UPDATE OR DELETE ON visit_contact_events FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TABLE visit_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL REFERENCES service_visits,
 uploaded_by uuid NOT NULL REFERENCES users, uploaded_at timestamptz NOT NULL,
 name varchar(120) NOT NULL, content_type text NOT NULL CHECK(content_type='image/jpeg'),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 4 AND 204800), sha256 text NOT NULL,
 deleted_at timestamptz, deleted_by uuid REFERENCES users, delete_reason text
);
CREATE INDEX private_visit_media ON visit_media(visit_id,uploaded_at) WHERE deleted_at IS NULL;

ALTER TABLE capacity_reservations ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE capacity_reservations ADD COLUMN visit_id uuid REFERENCES service_visits;
ALTER TABLE capacity_reservations ADD CONSTRAINT reservation_subject CHECK((booking_id IS NOT NULL)::int+(visit_id IS NOT NULL)::int=1);
CREATE UNIQUE INDEX visit_reservation_generation ON capacity_reservations(visit_id,generation) WHERE visit_id IS NOT NULL;
CREATE UNIQUE INDEX visit_active_hold ON capacity_reservations(visit_id) WHERE status='ACTIVE';
ALTER TABLE consents ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE consents ADD COLUMN visit_id uuid REFERENCES service_visits;
ALTER TABLE consents ADD CONSTRAINT consent_subject CHECK((booking_id IS NOT NULL)::int+(visit_id IS NOT NULL)::int=1);
