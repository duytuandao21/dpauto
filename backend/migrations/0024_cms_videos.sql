-- CMS videos: stored as uploaded in object storage, without image variants, share image or size.
ALTER TABLE cms_assets DROP CONSTRAINT cms_assets_storage_shape;
ALTER TABLE cms_assets ADD CONSTRAINT cms_assets_storage_shape CHECK (
 (storage = 'db' AND content IS NOT NULL AND octet_length(content) BETWEEN 4 AND 204800)
 OR (storage <> 'db' AND content IS NULL AND original_key IS NOT NULL AND mime LIKE 'video/%'
     AND bytes IS NOT NULL AND jsonb_typeof(variants) = 'array')
 OR (storage <> 'db' AND content IS NULL AND original_key IS NOT NULL AND og_key IS NOT NULL
     AND mime IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL AND bytes IS NOT NULL
     AND jsonb_typeof(variants) = 'array' AND jsonb_array_length(variants) > 0)
);
