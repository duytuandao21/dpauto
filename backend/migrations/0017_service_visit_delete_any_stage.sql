ALTER TABLE service_visits DROP CONSTRAINT service_visit_deleted_valid;
ALTER TABLE service_visits ADD CONSTRAINT service_visit_deleted_valid CHECK(
 (deleted_at IS NULL)=(deleted_by IS NULL)
);

DROP INDEX vehicle_open_visit;
CREATE UNIQUE INDEX vehicle_open_visit ON service_visits(station_id,vehicle_id)
 WHERE deleted_at IS NULL AND stage NOT IN ('HANDED_OVER','COMPLETED','ABORTED');
