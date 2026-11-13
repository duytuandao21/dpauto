ALTER TABLE stations
  ADD COLUMN booking_slot_minutes integer NOT NULL DEFAULT 60 CHECK (booking_slot_minutes BETWEEN 15 AND 120),
  ADD COLUMN booking_slot_limit integer NOT NULL DEFAULT 5 CHECK (booking_slot_limit BETWEEN 1 AND 100),
  ADD COLUMN booking_hours jsonb NOT NULL DEFAULT '[{"weekday":0,"opensAt":"07:30","closesAt":"17:30"},{"weekday":1,"opensAt":"07:30","closesAt":"17:30"},{"weekday":2,"opensAt":"07:30","closesAt":"17:30"},{"weekday":3,"opensAt":"07:30","closesAt":"17:30"},{"weekday":4,"opensAt":"07:30","closesAt":"17:30"},{"weekday":5,"opensAt":"07:30","closesAt":"17:30"},{"weekday":6,"opensAt":"07:30","closesAt":"17:30"}]';

ALTER TABLE services ADD COLUMN estimated_duration_minutes integer NOT NULL DEFAULT 60 CHECK (estimated_duration_minutes BETWEEN 15 AND 1440);
UPDATE services s SET estimated_duration_minutes=GREATEST(15,COALESCE((SELECT max(r.offset_minutes+r.duration_minutes) FROM service_resource_requirements r WHERE r.service_id=s.id AND r.plan_revision=s.plan_revision),60));

CREATE TABLE booking_slot_overrides (
  id uuid PRIMARY KEY,
  station_id uuid NOT NULL REFERENCES stations,
  starts_at timestamptz NOT NULL,
  capacity_limit integer CHECK (capacity_limit BETWEEN 0 AND 100),
  closed boolean NOT NULL DEFAULT false,
  reason text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(station_id,starts_at)
);
CREATE INDEX booking_slot_count ON bookings(station_id,scheduled_start_at) WHERE status IN ('PENDING','CONFIRMED','ARRIVED','COMPLETED');

INSERT INTO services(code,name,category_id,active,bookable,sort_order,estimated_duration_minutes)
SELECT d.code,d.name,c.id,true,true,d.sort_order,d.duration
FROM (VALUES
  ('BAO_DUONG','Bảo dưỡng định kỳ','MAINTENANCE',10,120),
  ('THAY_DAU','Thay dầu / Lọc dầu','MAINTENANCE',20,45),
  ('KIEM_TRA_SUA_CHUA','Kiểm tra, sửa chữa','MAINTENANCE',30,60),
  ('LOP_PHANH_GAM','Lốp / Phanh / Gầm','MAINTENANCE',40,90),
  ('DIEN_DIEU_HOA','Điện / Điều hòa','MAINTENANCE',50,90),
  ('RUA_XE','Rửa xe và chăm sóc ngoại thất','DETAILING',60,60),
  ('VE_SINH_NOI_THAT','Vệ sinh nội thất','DETAILING',70,180),
  ('PHU_CERAMIC','Phủ ceramic','DETAILING',80,240),
  ('PHIM_CACH_NHIET','Dán phim cách nhiệt','ACCESSORIES',90,150),
  ('LAP_PHU_KIEN','Lắp đặt phụ kiện ô tô','ACCESSORIES',100,90),
  ('TU_VAN','Khác / Cần tư vấn','OTHER',110,30)
) AS d(code,name,category,sort_order,duration)
JOIN service_categories c ON c.code=d.category
ON CONFLICT(code) DO NOTHING;

UPDATE stations SET booking_enabled=true,configuration_version=configuration_version+1,catalog_version=catalog_version+1;
