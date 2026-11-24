-- Website content beyond pages/news/SEO: settings, menus, services, accessories and projects.
ALTER TABLE cms_documents DROP CONSTRAINT cms_documents_kind_check;
ALTER TABLE cms_documents ADD CONSTRAINT cms_documents_kind_check
 CHECK (kind IN ('SETTINGS','NAVIGATION','PAGE','SERVICE','NEWS','ACCESSORY','PROJECT','SEO'));
CREATE INDEX cms_documents_kind_updated ON cms_documents(station_id, kind, updated_at DESC, id);
