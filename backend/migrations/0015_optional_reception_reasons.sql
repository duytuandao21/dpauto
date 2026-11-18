DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT conname FROM pg_constraint
    WHERE conrelid='service_visits'::regclass AND contype='c'
      AND (pg_get_constraintdef(oid) LIKE '%odometer_missing_reason%' OR pg_get_constraintdef(oid) LIKE '%follow_up_reason%')
  LOOP
    EXECUTE format('ALTER TABLE service_visits DROP CONSTRAINT %I', item.conname);
  END LOOP;
END;
$$;
ALTER TABLE service_visits ADD CONSTRAINT visit_follow_up_not_self CHECK(follow_up_of_visit_id IS NULL OR follow_up_of_visit_id<>id);
