-- Readable service-ticket codes: PDV-<DDMMYY>-<NNN>, numbered per local day (like booking codes).
-- Existing tickets keep their DV-… codes (already printed on quotes and acceptance forms).
CREATE TABLE visit_daily_counters (
  day date PRIMARY KEY,
  last_value bigint NOT NULL CHECK (last_value > 0)
);
