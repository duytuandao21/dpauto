-- CMS images move from bytea to object storage (R2, or local disk in dev/test).
-- Existing rows keep storage='db' and their bytes until `npm run media -- migrate` converts them.
ALTER TABLE cms_assets DROP CONSTRAINT cms_assets_content_check;
ALTER TABLE cms_assets
 ALTER COLUMN content DROP NOT NULL,
 ADD COLUMN storage text NOT NULL DEFAULT 'db' CHECK(storage IN ('db','r2','local')),
 ADD COLUMN width integer CHECK(width > 0),
 ADD COLUMN height integer CHECK(height > 0),
 ADD COLUMN mime text,
 ADD COLUMN bytes integer CHECK(bytes > 0),
 ADD COLUMN original_key text,
 ADD COLUMN variants jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN og_key text,
 ADD COLUMN placeholder text,
 ADD COLUMN focal_x numeric(4,3) NOT NULL DEFAULT 0.5 CHECK(focal_x BETWEEN 0 AND 1),
 ADD COLUMN focal_y numeric(4,3) NOT NULL DEFAULT 0.5 CHECK(focal_y BETWEEN 0 AND 1),
 ADD COLUMN deleted_at timestamptz,
 ADD COLUMN deleted_by uuid REFERENCES users,
 ADD COLUMN purged_at timestamptz,
 ADD CONSTRAINT cms_assets_storage_shape CHECK (
  (storage = 'db' AND content IS NOT NULL AND octet_length(content) BETWEEN 4 AND 204800)
  OR (storage <> 'db' AND content IS NULL AND original_key IS NOT NULL AND og_key IS NOT NULL
      AND mime IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL AND bytes IS NOT NULL
      AND jsonb_typeof(variants) = 'array' AND jsonb_array_length(variants) > 0)
 ),
 ADD CONSTRAINT cms_assets_purge_after_delete CHECK (purged_at IS NULL OR deleted_at IS NOT NULL);
CREATE INDEX cms_assets_sha ON cms_assets(station_id, sha256) WHERE purged_at IS NULL;
CREATE INDEX cms_assets_library ON cms_assets(station_id, created_at, id) WHERE deleted_at IS NULL;
CREATE INDEX cms_assets_trash ON cms_assets(deleted_at) WHERE deleted_at IS NOT NULL AND purged_at IS NULL;
