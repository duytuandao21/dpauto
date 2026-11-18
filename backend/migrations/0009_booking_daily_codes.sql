CREATE TABLE booking_daily_counters (
  day date PRIMARY KEY,
  last_value bigint NOT NULL CHECK (last_value > 0)
);
