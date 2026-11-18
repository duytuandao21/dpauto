CREATE OR REPLACE VIEW authorized_quote_lines AS
SELECT l.*,r.visit_id FROM quote_lines l JOIN quote_revisions r ON r.id=l.revision_id
WHERE r.status='APPROVED' AND NOT EXISTS(
 SELECT 1 FROM quote_decisions d WHERE d.revision_id=r.id AND d.approved_line_ids IS NOT NULL AND NOT(l.id=ANY(d.approved_line_ids)))
 AND NOT EXISTS(SELECT 1 FROM visit_events e WHERE e.visit_id=r.visit_id AND e.type='QUOTE_SCOPE_VOIDED' AND (e.data->'lineIds') ? l.id::text);
