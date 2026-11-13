CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE stations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 code text NOT NULL UNIQUE, name varchar(120) NOT NULL, phone varchar(20) NOT NULL,
 address varchar(250) NOT NULL, timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh' CHECK(timezone='Asia/Ho_Chi_Minh'),
 directions_url text NOT NULL, privacy_notice_version text NOT NULL, marketing_notice_version text,
 configuration_version integer NOT NULL DEFAULT 1, catalog_version integer NOT NULL DEFAULT 1,
 qr_channel_version integer NOT NULL DEFAULT 1, booking_enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 email_normalized varchar(254) NOT NULL UNIQUE, status text NOT NULL CHECK(status IN ('ACTIVE','DISABLED')),
 auth_version integer NOT NULL DEFAULT 1 CHECK(auth_version>0), must_change_password boolean NOT NULL DEFAULT true,
 last_login_at timestamptz
);
CREATE TABLE user_credentials (
 user_id uuid PRIMARY KEY REFERENCES users ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
 password_hash text NOT NULL, password_salt text NOT NULL, algorithm text NOT NULL CHECK(algorithm='scrypt-v1'),
 parameters jsonb NOT NULL, changed_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE TABLE staff_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 station_id uuid NOT NULL REFERENCES stations, user_id uuid UNIQUE REFERENCES users,
 name varchar(100) NOT NULL, phone_normalized varchar(20) NOT NULL, email varchar(254) NOT NULL,
 job_role text NOT NULL CHECK(job_role IN ('MANAGER','ADVISOR','TECHNICIAN')), active boolean NOT NULL DEFAULT true
);
CREATE INDEX staff_station_active ON staff_profiles(station_id,active,job_role,id);
CREATE TABLE user_roles (
 user_id uuid PRIMARY KEY REFERENCES users, role_code text NOT NULL CHECK(role_code IN ('MANAGER','ADVISOR')),
 granted_by uuid REFERENCES users, granted_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_permission_grants (
 user_id uuid NOT NULL REFERENCES users, permission_code text NOT NULL CHECK(permission_code IN ('staff.manage','roles.manage')),
 granted_by uuid REFERENCES users, granted_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,permission_code)
);
CREATE TABLE sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 user_id uuid REFERENCES users, kind text NOT NULL CHECK(kind IN ('PREAUTH','AUTH')), token_hash text NOT NULL UNIQUE,
 csrf_token text NOT NULL, auth_version integer, issued_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 CHECK(expires_at>issued_at), CHECK((kind='PREAUTH' AND user_id IS NULL AND auth_version IS NULL) OR (kind='AUTH' AND user_id IS NOT NULL AND auth_version IS NOT NULL))
);
CREATE INDEX session_by_user ON sessions(user_id,revoked_at);
CREATE INDEX session_expiry ON sessions(expires_at);
CREATE TABLE customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 name varchar(100) NOT NULL, normalized_name text NOT NULL, phone_normalized varchar(20) NOT NULL,
 origin text NOT NULL CHECK(origin IN ('PUBLIC','STAFF','MIGRATION'))
);
CREATE INDEX customer_phone ON customers(phone_normalized);
CREATE INDEX customer_name ON customers(normalized_name,id);
CREATE TABLE vehicles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 model varchar(100), normalized_model text, plate_normalized varchar(20), model_year smallint CHECK(model_year>=1900),
 origin text NOT NULL CHECK(origin IN ('PUBLIC','STAFF','MIGRATION')), CHECK(model IS NOT NULL OR plate_normalized IS NOT NULL)
);
CREATE INDEX vehicle_plate ON vehicles(plate_normalized);
CREATE INDEX vehicle_model ON vehicles(normalized_model,id);
CREATE TABLE customer_vehicle_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 customer_id uuid NOT NULL REFERENCES customers, vehicle_id uuid NOT NULL REFERENCES vehicles,
 relationship text NOT NULL DEFAULT 'CONTACT', verified_at timestamptz, valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz,
 source text NOT NULL, UNIQUE(customer_id,vehicle_id,relationship,valid_from), CHECK(valid_to IS NULL OR valid_to>valid_from)
);
CREATE INDEX customer_links ON customer_vehicle_links(customer_id,valid_to);
CREATE INDEX vehicle_links ON customer_vehicle_links(vehicle_id,valid_to);
CREATE TABLE service_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 code text NOT NULL UNIQUE, name varchar(120) NOT NULL, sort_order integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true
);
CREATE TABLE services (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 category_id uuid NOT NULL REFERENCES service_categories, code text NOT NULL UNIQUE, name varchar(120) NOT NULL,
 description text, marketing_slug text UNIQUE, active boolean NOT NULL, bookable boolean NOT NULL,
 sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0), plan_revision integer NOT NULL DEFAULT 1 CHECK(plan_revision>0),
 CHECK(NOT bookable OR active)
);
CREATE INDEX service_catalog ON services(category_id,active,bookable,sort_order,id);
CREATE TABLE resource_pools (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 station_id uuid NOT NULL REFERENCES stations, code text NOT NULL, name varchar(120) NOT NULL,
 kind text NOT NULL CHECK(kind IN ('INTAKE','EXECUTION','EQUIPMENT')), UNIQUE(station_id,code)
);
CREATE TABLE resource_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 station_id uuid NOT NULL REFERENCES stations, code text NOT NULL, name varchar(120) NOT NULL,
 staff_id uuid UNIQUE REFERENCES staff_profiles, introduced_at timestamptz NOT NULL DEFAULT now(), retired_at timestamptz,
 UNIQUE(station_id,code), CHECK(retired_at IS NULL OR retired_at>=introduced_at)
);
CREATE INDEX resource_active ON resource_units(station_id,retired_at,id);
CREATE TABLE capacity_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 station_id uuid NOT NULL REFERENCES stations, policy_version integer NOT NULL,
 effective_from timestamptz NOT NULL, effective_to timestamptz,
 bucket_minutes integer NOT NULL CHECK(bucket_minutes BETWEEN 5 AND 120),
 start_grid_minutes integer NOT NULL CHECK(start_grid_minutes BETWEEN 5 AND 120),
 lead_minutes integer NOT NULL CHECK(lead_minutes BETWEEN 0 AND 1440),
 advance_days integer NOT NULL CHECK(advance_days BETWEEN 1 AND 365),
 no_show_grace_minutes integer NOT NULL CHECK(no_show_grace_minutes BETWEEN 0 AND 1440),
 published_by uuid NOT NULL REFERENCES users, UNIQUE(station_id,policy_version),
 CHECK(effective_to IS NULL OR effective_to>effective_from),
 EXCLUDE USING gist (station_id WITH =, tstzrange(effective_from,effective_to,'[)') WITH &&)
);
CREATE INDEX policy_effective ON capacity_policies(station_id,effective_from DESC);
CREATE TABLE resource_pool_members (
 policy_id uuid NOT NULL REFERENCES capacity_policies, pool_id uuid NOT NULL REFERENCES resource_pools,
 resource_id uuid NOT NULL REFERENCES resource_units, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(policy_id,pool_id,resource_id)
);
CREATE INDEX resource_membership ON resource_pool_members(resource_id,policy_id);
CREATE TABLE business_hours (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 policy_id uuid NOT NULL REFERENCES capacity_policies, resource_id uuid REFERENCES resource_units,
 weekday smallint NOT NULL CHECK(weekday BETWEEN 0 AND 6), opens_at time NOT NULL, closes_at time NOT NULL,
 CHECK(closes_at>opens_at)
);
CREATE UNIQUE INDEX station_hours_unique ON business_hours(policy_id,weekday,opens_at) WHERE resource_id IS NULL;
CREATE UNIQUE INDEX resource_hours_unique ON business_hours(policy_id,resource_id,weekday,opens_at) WHERE resource_id IS NOT NULL;
CREATE TABLE service_resource_requirements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 service_id uuid NOT NULL REFERENCES services, plan_revision integer NOT NULL,
 sequence_no integer NOT NULL, pool_id uuid NOT NULL REFERENCES resource_pools,
 units integer NOT NULL CHECK(units BETWEEN 1 AND 256), offset_minutes integer NOT NULL CHECK(offset_minutes>=0),
 duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 1 AND 1440),
 CHECK(offset_minutes+duration_minutes<=1440), UNIQUE(service_id,plan_revision,sequence_no)
);
CREATE INDEX requirement_pool ON service_resource_requirements(pool_id);
CREATE TABLE calendar_blocks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 station_id uuid NOT NULL REFERENCES stations, pool_id uuid REFERENCES resource_pools, resource_id uuid REFERENCES resource_units,
 kind text NOT NULL CHECK(kind IN ('HOLIDAY','MAINTENANCE','MANUAL_CLOSE')), starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL, reason varchar(400) NOT NULL, created_by uuid NOT NULL REFERENCES users, retired_at timestamptz,
 CHECK(ends_at>starts_at), CHECK(pool_id IS NULL OR resource_id IS NULL)
);
CREATE INDEX block_interval ON calendar_blocks(station_id,starts_at,ends_at);
CREATE TABLE capacity_buckets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 station_id uuid NOT NULL REFERENCES stations, pool_id uuid NOT NULL REFERENCES resource_pools,
 origin_policy_id uuid NOT NULL REFERENCES capacity_policies, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 capacity_limit integer NOT NULL CHECK(capacity_limit>=0), held_units integer NOT NULL DEFAULT 0,
 closed boolean NOT NULL DEFAULT false, is_override boolean NOT NULL DEFAULT false, retired_at timestamptz,
 CHECK(ends_at>starts_at), CHECK(held_units>=0 AND held_units<=capacity_limit)
);
CREATE UNIQUE INDEX bucket_active_unique ON capacity_buckets(pool_id,starts_at) WHERE retired_at IS NULL;
CREATE INDEX bucket_calendar ON capacity_buckets(station_id,starts_at);
CREATE TABLE bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 station_id uuid NOT NULL REFERENCES stations, code text NOT NULL UNIQUE,
 customer_id uuid NOT NULL REFERENCES customers, vehicle_id uuid REFERENCES vehicles,
 contact_snapshot jsonb NOT NULL, vehicle_snapshot jsonb,
 requested_start_at timestamptz NOT NULL, scheduled_start_at timestamptz NOT NULL, confirmed_start_at timestamptz,
 status text NOT NULL CHECK(status IN ('PENDING','CONFIRMED','ARRIVED','COMPLETED','CANCELLED','NO_SHOW')),
 source text NOT NULL CHECK(source IN ('WEBSITE','QR','PHONE','AT_STATION','ZALO','OTHER')),
 assigned_advisor_id uuid REFERENCES staff_profiles, customer_note text, internal_note text,
 change_kind text NOT NULL DEFAULT 'NEW' CHECK(change_kind IN ('NEW','RESCHEDULED','CANCELLED')),
 created_by uuid REFERENCES users, cancelled_at timestamptz, cancel_reason text,
 arrived_at timestamptz, completed_at timestamptz, last_contact_outcome text,
 CHECK(status NOT IN ('CONFIRMED','ARRIVED','COMPLETED') OR confirmed_start_at IS NOT NULL)
);
CREATE INDEX booking_calendar ON bookings(station_id,scheduled_start_at,id);
CREATE INDEX advisor_booking_calendar ON bookings(assigned_advisor_id,status,scheduled_start_at,id);
CREATE INDEX customer_booking_history ON bookings(customer_id,created_at,id);
CREATE INDEX vehicle_booking_history ON bookings(vehicle_id,created_at,id);
CREATE TABLE booking_services (
 booking_id uuid NOT NULL REFERENCES bookings, service_id uuid NOT NULL REFERENCES services,
 created_at timestamptz NOT NULL DEFAULT now(), sequence_no integer NOT NULL,
 service_name_snapshot text NOT NULL, plan_revision integer NOT NULL, plan_snapshot jsonb NOT NULL,
 catalog_version integer NOT NULL, PRIMARY KEY(booking_id,service_id), UNIQUE(booking_id,sequence_no)
);
CREATE INDEX bookings_by_service ON booking_services(service_id,booking_id);
CREATE TABLE capacity_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 booking_id uuid NOT NULL REFERENCES bookings, status text NOT NULL CHECK(status IN ('ACTIVE','RELEASED')),
 generation integer NOT NULL CHECK(generation>0), policy_version integer NOT NULL,
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, held_at timestamptz NOT NULL DEFAULT now(),
 released_at timestamptz, release_reason text, UNIQUE(booking_id,generation), CHECK(end_at>start_at),
 CHECK((status='ACTIVE' AND released_at IS NULL) OR (status='RELEASED' AND released_at IS NOT NULL))
);
CREATE UNIQUE INDEX booking_active_hold ON capacity_reservations(booking_id) WHERE status='ACTIVE';
CREATE INDEX active_reservations ON capacity_reservations(status,start_at);
CREATE TABLE reservation_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 reservation_id uuid NOT NULL REFERENCES capacity_reservations, resource_id uuid NOT NULL REFERENCES resource_units,
 requirement_keys text[] NOT NULL CHECK(cardinality(requirement_keys)>0), start_at timestamptz NOT NULL,
 end_at timestamptz NOT NULL, released_at timestamptz, CHECK(end_at>start_at),
 EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&) WHERE (released_at IS NULL)
);
CREATE UNIQUE INDEX allocation_unique ON reservation_allocations(reservation_id,resource_id,start_at,end_at) WHERE released_at IS NULL;
CREATE INDEX allocation_reservation ON reservation_allocations(reservation_id,released_at);
CREATE TABLE reservation_bucket_charges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 reservation_id uuid NOT NULL REFERENCES capacity_reservations, bucket_id uuid NOT NULL REFERENCES capacity_buckets,
 units integer NOT NULL CHECK(units>0), released_at timestamptz
);
CREATE UNIQUE INDEX charge_unique ON reservation_bucket_charges(reservation_id,bucket_id) WHERE released_at IS NULL;
CREATE INDEX charge_bucket ON reservation_bucket_charges(bucket_id,released_at);
CREATE TABLE booking_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 booking_id uuid NOT NULL REFERENCES bookings, advisor_id uuid NOT NULL REFERENCES staff_profiles,
 assigned_by uuid NOT NULL REFERENCES users, assigned_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
 reason varchar(400) NOT NULL, historical_snapshot jsonb, CHECK(ended_at IS NULL OR ended_at>assigned_at)
);
CREATE UNIQUE INDEX current_assignment ON booking_assignments(booking_id) WHERE ended_at IS NULL;
CREATE INDEX advisor_history ON booking_assignments(advisor_id,assigned_at,id);
CREATE TABLE booking_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 booking_id uuid NOT NULL REFERENCES bookings, type text NOT NULL, actor_user_id uuid REFERENCES users,
 actor_type text NOT NULL CHECK(actor_type IN ('PUBLIC','STAFF','SYSTEM')), occurred_at timestamptz NOT NULL DEFAULT now(),
 reason text, before_data jsonb, after_data jsonb
);
CREATE INDEX booking_timeline ON booking_events(booking_id,occurred_at,id);
CREATE TABLE booking_contact_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 booking_id uuid NOT NULL REFERENCES bookings, actor_user_id uuid NOT NULL REFERENCES users,
 channel text NOT NULL CHECK(channel IN ('PHONE','ZALO','IN_PERSON','OTHER')),
 outcome text NOT NULL CHECK(outcome IN ('UNREACHED','AGREED','PROPOSED_TIME','DECLINED','OTHER')),
 proposed_start_at timestamptz, customer_accepted boolean, note_internal text, contacted_at timestamptz NOT NULL DEFAULT now(),
 CHECK(outcome<>'PROPOSED_TIME' OR proposed_start_at IS NOT NULL)
);
CREATE INDEX booking_contact_timeline ON booking_contact_events(booking_id,contacted_at,id);
CREATE TABLE consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 customer_id uuid NOT NULL REFERENCES customers, booking_id uuid NOT NULL REFERENCES bookings,
 type text NOT NULL CHECK(type IN ('SERVICE_NOTICE_ACK','MARKETING')), notice_version text NOT NULL,
 granted boolean NOT NULL, source text NOT NULL, recorded_by uuid REFERENCES users, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_history ON consents(customer_id,type,recorded_at);
CREATE TABLE idempotency_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 scope text NOT NULL, key_hash text NOT NULL, request_fingerprint text NOT NULL,
 state text NOT NULL CHECK(state IN ('IN_PROGRESS','COMPLETED')), resource_type text, resource_id uuid,
 response_status smallint, response_receipt jsonb, expires_at timestamptz NOT NULL,
 UNIQUE(scope,key_hash)
);
CREATE INDEX key_expiry ON idempotency_keys(expires_at);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 actor_user_id uuid REFERENCES users, actor_type text NOT NULL, action text NOT NULL, entity_type text NOT NULL,
 entity_id uuid, reason text, occurred_at timestamptz NOT NULL DEFAULT now(), request_id text NOT NULL,
 correlation_id text NOT NULL, summary text NOT NULL, before_data jsonb, after_data jsonb
);
CREATE INDEX audit_time ON audit_logs(occurred_at,id);
CREATE INDEX audit_entity ON audit_logs(entity_type,entity_id,occurred_at);
CREATE INDEX audit_actor ON audit_logs(actor_user_id,occurred_at);
CREATE TABLE outbox_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1,
 event_key text NOT NULL, kind text NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
 payload jsonb NOT NULL, status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','SENT','FAILED')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), scheduled_at timestamptz NOT NULL DEFAULT now(),
 next_attempt_at timestamptz, lease_until timestamptz, last_error_code text, UNIQUE(kind,event_key)
);
CREATE INDEX outbox_due ON outbox_jobs(status,next_attempt_at,scheduled_at);
CREATE TABLE rate_limit_buckets (
 scope text NOT NULL, subject_hash text NOT NULL, window_start timestamptz NOT NULL,
 window_seconds integer NOT NULL CHECK(window_seconds>0), hits integer NOT NULL CHECK(hits>=0),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 PRIMARY KEY(scope,subject_hash,window_start)
);
CREATE INDEX rate_expiry ON rate_limit_buckets(expires_at);

CREATE FUNCTION deny_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'History is append-only' USING ERRCODE='23514'; END;
$$;
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON booking_events FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_contacts BEFORE UPDATE OR DELETE ON booking_contact_events FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_consents BEFORE UPDATE OR DELETE ON consents FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();

INSERT INTO service_categories(code,name,sort_order) VALUES
 ('MAINTENANCE','Bảo dưỡng',0),('DETAILING','Chăm sóc xe',1),('ACCESSORIES','Phụ kiện',2),('OTHER','Khác',3);
