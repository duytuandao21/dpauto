-- Deleted list items (services, news, accessories, projects) leave the admin; revisions stay as immutable history.
ALTER TABLE cms_documents ADD COLUMN deleted_at timestamptz;
