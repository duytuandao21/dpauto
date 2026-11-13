ALTER TABLE user_permission_grants DROP CONSTRAINT user_permission_grants_permission_code_check;
ALTER TABLE user_permission_grants ADD CHECK(permission_code IN ('staff.manage','roles.manage','inventory.manage','inventory.adjust','inventory.cost.read','finance.read','payments.collect','payments.refund'));
ALTER TABLE visit_handovers DROP CONSTRAINT visit_handovers_payment_basis_check;
ALTER TABLE visit_handovers DROP CONSTRAINT visit_handovers_approved_obligation_check;
ALTER TABLE visit_handovers ADD CHECK(payment_basis IN ('NO_CHARGE','SETTLED'));
ALTER TABLE visit_handovers ADD CHECK(approved_obligation>=0);
ALTER TABLE visit_handovers ADD COLUMN net_received numeric(18,0) NOT NULL DEFAULT 0 CHECK(net_received>=approved_obligation);

CREATE TABLE parts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),station_id uuid NOT NULL REFERENCES stations,
 code varchar(50) NOT NULL,name varchar(160) NOT NULL,unit varchar(30) NOT NULL,active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL,UNIQUE(station_id,code)
);
CREATE TABLE warehouses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),station_id uuid NOT NULL REFERENCES stations,
 code varchar(50) NOT NULL,name varchar(120) NOT NULL,active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL,UNIQUE(station_id,code)
);
CREATE TABLE stock_balances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 warehouse_id uuid NOT NULL REFERENCES warehouses,part_id uuid NOT NULL REFERENCES parts,
 on_hand numeric(16,3) NOT NULL DEFAULT 0,reserved numeric(16,3) NOT NULL DEFAULT 0,
 carrying_value numeric(18,0) NOT NULL DEFAULT 0,version integer NOT NULL DEFAULT 1,
 UNIQUE(warehouse_id,part_id),CHECK(on_hand>=reserved AND reserved>=0 AND carrying_value>=0),CHECK(on_hand>0 OR carrying_value=0)
);
CREATE TABLE stock_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),visit_id uuid NOT NULL REFERENCES service_visits,
 quote_line_id uuid NOT NULL UNIQUE REFERENCES quote_lines,warehouse_id uuid NOT NULL REFERENCES warehouses,part_id uuid NOT NULL REFERENCES parts,
 quantity numeric(16,3) NOT NULL CHECK(quantity>0),reserved numeric(16,3) NOT NULL DEFAULT 0 CHECK(reserved>=0),
 version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL
);
CREATE INDEX visit_stock_requests ON stock_requests(visit_id,id);
CREATE TABLE stock_reservation_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES stock_requests,quantity numeric(16,3) NOT NULL CHECK(quantity<>0),
 actor_user_id uuid NOT NULL REFERENCES users,occurred_at timestamptz NOT NULL,reason text NOT NULL
);
CREATE TABLE stock_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),station_id uuid NOT NULL REFERENCES stations,command_id uuid NOT NULL,
 warehouse_id uuid NOT NULL REFERENCES warehouses,kind text NOT NULL CHECK(kind IN ('RECEIPT','ISSUE','RETURN','ADJUSTMENT','STOCKTAKE')),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED')),version integer NOT NULL DEFAULT 1,
 counterparty text NOT NULL DEFAULT '',reason text NOT NULL,created_by uuid NOT NULL REFERENCES users,created_at timestamptz NOT NULL,
 posted_by uuid REFERENCES users,posted_at timestamptz,UNIQUE(station_id,command_id)
);
CREATE TABLE stock_document_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid NOT NULL REFERENCES stock_documents,
 sequence_no integer NOT NULL,part_id uuid NOT NULL REFERENCES parts,quantity numeric(16,3) NOT NULL,
 unit_cost numeric(15,0),request_id uuid REFERENCES stock_requests,original_line_id uuid REFERENCES stock_document_lines,
 return_condition text CHECK(return_condition IN ('RESTOCK','SCRAP')),expected_balance_version integer,
 quantity_delta numeric(16,3),value_delta numeric(18,0),part_snapshot jsonb NOT NULL,UNIQUE(document_id,sequence_no)
);
CREATE TABLE stock_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_line_id uuid NOT NULL UNIQUE REFERENCES stock_document_lines,
 warehouse_id uuid NOT NULL REFERENCES warehouses,part_id uuid NOT NULL REFERENCES parts,
 quantity_delta numeric(16,3) NOT NULL,value_delta numeric(18,0) NOT NULL,occurred_at timestamptz NOT NULL
);
CREATE INDEX stock_ledger_history ON stock_ledger(warehouse_id,part_id,occurred_at,id);
CREATE TABLE cash_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),station_id uuid NOT NULL REFERENCES stations,command_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('DEPOSIT','COLLECT','REFUND','REVERSAL')),amount numeric(18,0) NOT NULL CHECK(amount>0),
 currency text NOT NULL DEFAULT 'VND' CHECK(currency='VND'),method text NOT NULL CHECK(method IN ('CASH','BANK_TRANSFER','CARD','OTHER')),
 booking_id uuid REFERENCES bookings,visit_id uuid REFERENCES service_visits,customer_id uuid REFERENCES customers,
 original_id uuid REFERENCES cash_entries,reference text NOT NULL,payer_name text NOT NULL,reason text NOT NULL,
 recorded_by uuid NOT NULL REFERENCES users,occurred_at timestamptz NOT NULL,print_snapshot jsonb NOT NULL,
 UNIQUE(station_id,command_id),CHECK(num_nonnulls(booking_id,visit_id,customer_id)=1),
 CHECK((kind IN ('DEPOSIT','COLLECT') AND original_id IS NULL) OR (kind IN ('REFUND','REVERSAL') AND original_id IS NOT NULL))
);
CREATE INDEX cash_entry_history ON cash_entries(station_id,occurred_at,id);
CREATE UNIQUE INDEX cash_external_reference ON cash_entries(station_id,method,reference) WHERE kind IN ('DEPOSIT','COLLECT') AND method IN ('BANK_TRANSFER','CARD');
CREATE INDEX cash_original ON cash_entries(original_id);
CREATE TABLE obligation_credits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),visit_id uuid NOT NULL REFERENCES service_visits,command_id uuid NOT NULL UNIQUE,
 amount numeric(18,0) NOT NULL CHECK(amount>0),reason text NOT NULL,evidence text NOT NULL,
 approved_by uuid NOT NULL REFERENCES users,occurred_at timestamptz NOT NULL
);
CREATE INDEX obligation_credit_visit ON obligation_credits(visit_id);
CREATE TABLE cash_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_id uuid NOT NULL REFERENCES cash_entries,visit_id uuid NOT NULL REFERENCES service_visits,
 amount numeric(18,0) NOT NULL CHECK(amount>0),command_id uuid NOT NULL UNIQUE,recorded_by uuid NOT NULL REFERENCES users,occurred_at timestamptz NOT NULL,reason text NOT NULL
);
CREATE INDEX visit_cash_allocations ON cash_allocations(visit_id,payment_id);
CREATE TABLE cash_reductions (
 entry_id uuid NOT NULL REFERENCES cash_entries,allocation_id uuid REFERENCES cash_allocations,amount numeric(18,0) NOT NULL CHECK(amount>0),
 UNIQUE NULLS NOT DISTINCT(entry_id,allocation_id)
);
CREATE FUNCTION protect_stock_document() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
  IF OLD.status='POSTED' THEN RAISE EXCEPTION 'Posted stock document is immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END;
$$;
CREATE TRIGGER protect_stock_document BEFORE UPDATE OR DELETE ON stock_documents FOR EACH ROW EXECUTE FUNCTION protect_stock_document();
CREATE FUNCTION protect_stock_line() RETURNS trigger LANGUAGE plpgsql AS $$
 DECLARE parent_id uuid;
 BEGIN
  parent_id=CASE WHEN TG_OP='DELETE' THEN OLD.document_id ELSE NEW.document_id END;
  IF EXISTS(SELECT 1 FROM stock_documents WHERE id=parent_id AND status='POSTED') OR (TG_OP='UPDATE' AND OLD.document_id<>NEW.document_id)
   THEN RAISE EXCEPTION 'Posted stock line is immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END;
$$;
CREATE TRIGGER protect_stock_line BEFORE INSERT OR UPDATE OR DELETE ON stock_document_lines FOR EACH ROW EXECUTE FUNCTION protect_stock_line();
CREATE TRIGGER immutable_stock_ledger BEFORE UPDATE OR DELETE ON stock_ledger FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_stock_reservations BEFORE UPDATE OR DELETE ON stock_reservation_events FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_cash_entries BEFORE UPDATE OR DELETE ON cash_entries FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_cash_allocations BEFORE UPDATE OR DELETE ON cash_allocations FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_cash_reductions BEFORE UPDATE OR DELETE ON cash_reductions FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
CREATE TRIGGER immutable_obligation_credits BEFORE UPDATE OR DELETE ON obligation_credits FOR EACH ROW EXECUTE FUNCTION deny_history_mutation();
