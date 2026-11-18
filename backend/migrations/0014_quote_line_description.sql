ALTER TABLE quote_lines ADD COLUMN description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500);
