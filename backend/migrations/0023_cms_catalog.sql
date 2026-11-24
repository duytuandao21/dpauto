-- Accessory brands and categories managed in the admin (one CATALOG document, key "accessories").
ALTER TABLE cms_documents DROP CONSTRAINT cms_documents_kind_check;
ALTER TABLE cms_documents ADD CONSTRAINT cms_documents_kind_check
 CHECK (kind IN ('SETTINGS','NAVIGATION','PAGE','SERVICE','NEWS','ACCESSORY','PROJECT','SEO','CATALOG'));
