-- CMS keeps no version history: each document holds only its live revision (plus at most one unsaved-to-website draft).
DROP TRIGGER IF EXISTS immutable_cms_revisions ON cms_revisions;
DROP TRIGGER IF EXISTS immutable_cms_revision_assets ON cms_revision_assets;
CREATE TEMP TABLE cms_keep_revisions ON COMMIT DROP AS
  SELECT published_revision_id AS id FROM cms_documents WHERE published_revision_id IS NOT NULL
  UNION
  SELECT (SELECT r.id FROM cms_revisions r WHERE r.document_id=d.id ORDER BY r.revision_no DESC LIMIT 1)
  FROM cms_documents d WHERE d.deleted_at IS NULL;
DELETE FROM cms_keep_revisions WHERE id IS NULL;
DELETE FROM cms_revision_assets WHERE revision_id NOT IN (SELECT id FROM cms_keep_revisions);
DELETE FROM cms_revisions WHERE id NOT IN (SELECT id FROM cms_keep_revisions);
