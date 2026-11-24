-- Website services become the operations catalogue (marketing_slug = CMS key).
-- Visible published SERVICE documents get a bookable service; time and group come from the
-- operations service they replace, else 60 minutes in "Khác".
WITH web AS (
  SELECT d.key, r.payload
  FROM cms_documents d JOIN cms_revisions r ON r.id = d.published_revision_id
  WHERE d.kind = 'SERVICE' AND d.deleted_at IS NULL AND NOT d.withdrawn
    AND coalesce(r.payload->>'title', '') <> ''
    AND coalesce((r.payload->>'hidden')::boolean, false) = false
), template(key, code) AS (VALUES
  ('detail-wash', 'BAO_DUONG'), ('ceramic-coating', 'PHU_CERAMIC'),
  ('window-tint', 'PHIM_CACH_NHIET'), ('interior-detailing', 'VE_SINH_NOI_THAT'),
  ('nang-cap-lap-dat-phu-kien-o-to', 'LAP_PHU_KIEN'), ('sua-chua-o-to', 'KIEM_TRA_SUA_CHUA')
)
INSERT INTO services (code, name, category_id, active, bookable, sort_order, description,
  marketing_slug, estimated_duration_minutes, quality_checks, technician_required)
SELECT left('WEB_' || upper(regexp_replace(w.key, '[^a-zA-Z0-9]+', '_', 'g')), 64),
  left(w.payload->>'title', 120),
  coalesce(t.category_id, (SELECT id FROM service_categories WHERE code = 'OTHER')),
  true, true, greatest(coalesce((w.payload->>'order')::int, 0), 0),
  nullif(w.payload->>'description', ''), w.key,
  coalesce((w.payload->>'durationMinutes')::int, t.estimated_duration_minutes, 60),
  coalesce(t.quality_checks, '[]'::jsonb), coalesce(t.technician_required, false)
FROM web w
LEFT JOIN template m ON m.key = w.key
LEFT JOIN services t ON t.code = m.code
ON CONFLICT (code) DO NOTHING;

-- The former operations-only services leave booking and the pick lists; past bookings and
-- tickets keep their own name snapshots.
UPDATE services SET active = false, bookable = false, version = version + 1, updated_at = now()
WHERE marketing_slug IS NULL AND active;

UPDATE stations SET catalog_version = catalog_version + 1;
