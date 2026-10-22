-- Dukaan Saathi initial PostgreSQL schema for Railway.
-- Apply once to a new Railway PostgreSQL database. Keep the database private.
-- Application authorization is enforced by server-side session checks and owner-scoped SQL.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  business_type text not null default 'general',
  currency_code text not null default 'INR' check (currency_code = 'INR'),
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  party_type text not null check (party_type in ('customer', 'supplier', 'both')),
  name text not null check (length(trim(name)) between 1 and 160),
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create index if not exists parties_business_name_idx on public.parties (business_id, lower(name));

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sku text,
  name text not null check (length(trim(name)) between 1 and 160),
  unit text not null default 'piece',
  selling_price_paise bigint not null default 0 check (selling_price_paise >= 0),
  cost_price_paise bigint not null default 0 check (cost_price_paise >= 0),
  track_stock boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create unique index if not exists products_business_sku_unique
  on public.products (business_id, lower(sku)) where sku is not null and trim(sku) <> '';

create table if not exists public.business_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  transaction_type text not null check (transaction_type in (
    'sale', 'purchase', 'expense', 'customer_receipt', 'supplier_payment',
    'sales_refund', 'purchase_return', 'other_income', 'cash_adjustment'
  )),
  status text not null default 'posted' check (status in ('draft', 'posted', 'void')),
  document_no text not null,
  business_date date not null,
  amount_paise bigint not null check (amount_paise >= 0),
  cash_delta_paise bigint,
  party_id uuid,
  idempotency_key text not null check (length(trim(idempotency_key)) between 8 and 200),
  notes text,
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  reversed_transaction_id uuid references public.business_transactions(id) on delete restrict,
  unique (business_id, id),
  unique (business_id, idempotency_key),
  unique (business_id, document_no),
  foreign key (business_id, party_id) references public.parties(business_id, id),
  check (
    (transaction_type = 'cash_adjustment' and cash_delta_paise is not null and cash_delta_paise <> 0)
    or
    (transaction_type <> 'cash_adjustment' and cash_delta_paise is null and amount_paise > 0)
  ),
  check (status <> 'posted' or posted_at is not null)
);

create index if not exists transactions_business_date_idx
  on public.business_transactions (business_id, business_date desc, created_at desc);
create index if not exists transactions_business_type_date_idx
  on public.business_transactions (business_id, transaction_type, business_date desc);
create index if not exists transactions_party_idx
  on public.business_transactions (business_id, party_id, business_date desc);

create table if not exists public.transaction_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  transaction_id uuid not null,
  line_no integer not null check (line_no > 0),
  product_id uuid,
  description text not null check (length(trim(description)) between 1 and 240),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price_paise bigint not null check (unit_price_paise >= 0),
  discount_paise bigint not null default 0 check (discount_paise >= 0),
  tax_paise bigint not null default 0 check (tax_paise >= 0),
  line_total_paise bigint not null check (line_total_paise >= 0),
  created_at timestamptz not null default now(),
  unique (transaction_id, line_no),
  foreign key (business_id, transaction_id)
    references public.business_transactions(business_id, id) on delete restrict,
  foreign key (business_id, product_id) references public.products(business_id, id)
);

create table if not exists public.transaction_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  transaction_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0),
  payment_method text not null check (payment_method in ('cash', 'upi', 'bank', 'card', 'other')),
  payment_date date not null,
  reference text,
  created_at timestamptz not null default now(),
  foreign key (business_id, transaction_id)
    references public.business_transactions(business_id, id) on delete restrict
);

create index if not exists transaction_payments_business_date_idx
  on public.transaction_payments (business_id, payment_date desc);
create index if not exists transaction_payments_transaction_idx
  on public.transaction_payments (transaction_id);

-- Links customer receipts to sales invoices and supplier payments to purchase bills.
-- Payment records remain the source of cash movement; allocations only settle invoice balances.
create table if not exists public.transaction_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  settlement_transaction_id uuid not null,
  invoice_transaction_id uuid not null,
  amount_paise bigint not null check (amount_paise > 0),
  created_at timestamptz not null default now(),
  unique (business_id, settlement_transaction_id, invoice_transaction_id),
  foreign key (business_id, settlement_transaction_id)
    references public.business_transactions(business_id, id) on delete restrict,
  foreign key (business_id, invoice_transaction_id)
    references public.business_transactions(business_id, id) on delete restrict,
  check (settlement_transaction_id <> invoice_transaction_id)
);

create index if not exists transaction_allocations_invoice_idx
  on public.transaction_allocations (business_id, invoice_transaction_id);
create index if not exists transaction_allocations_settlement_idx
  on public.transaction_allocations (business_id, settlement_transaction_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null,
  transaction_id uuid,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  reason text not null check (reason in ('purchase', 'sale', 'sales_return', 'purchase_return', 'adjustment', 'opening_stock')),
  notes text,
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (business_id, product_id) references public.products(business_id, id),
  foreign key (business_id, transaction_id)
    references public.business_transactions(business_id, id) on delete restrict
);

create index if not exists stock_movements_product_idx
  on public.stock_movements (business_id, product_id, created_at desc);

create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  business_date date not null,
  opening_cash_paise bigint not null check (opening_cash_paise >= 0),
  expected_cash_paise bigint not null,
  counted_cash_paise bigint not null check (counted_cash_paise >= 0),
  difference_paise bigint generated always as (counted_cash_paise - expected_cash_paise) stored,
  notes text,
  closed_by uuid not null references public.app_users(id) on delete restrict,
  closed_at timestamptz not null default now(),
  unique (business_id, business_date)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_user_id uuid references public.app_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_business_created_idx
  on public.audit_logs (business_id, created_at desc);

-- This app uses a private Railway PostgreSQL connection and a server-only DB role.
-- Do not expose DATABASE_URL to the browser. API handlers authenticate the signed
-- session and include owner_user_id/business_id in all data access queries.

-- A single RPC inserts the transaction and its payments atomically. It is deliberately
-- a narrow first API; item lines and stock movements will be included in the next step.
create or replace function public.create_business_transaction(p_payload jsonb)
returns public.business_transactions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_business_id uuid := (p_payload->>'business_id')::uuid;
  v_type text := p_payload->>'transaction_type';
  v_date date := (p_payload->>'business_date')::date;
  v_amount bigint := (p_payload->>'amount_paise')::bigint;
  v_party_id uuid := nullif(p_payload->>'party_id', '')::uuid;
  v_key text := p_payload->>'idempotency_key';
  v_notes text := nullif(p_payload->>'notes', '');
  v_cash_delta bigint := nullif(p_payload->>'cash_delta_paise', '')::bigint;
  v_payment_total bigint := 0;
  v_allocation_total bigint := 0;
  v_payment jsonb;
  v_allocation jsonb;
  v_invoice public.business_transactions;
  v_invoice_due bigint;
  v_expected_invoice_type text;
  v_doc_no text;
  v_existing public.business_transactions;
  v_created public.business_transactions;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.businesses
    where id = v_business_id and owner_user_id = v_user_id
  ) then
    raise exception 'Business not found or access denied' using errcode = '42501';
  end if;

  if v_type is null or v_type not in ('sale', 'purchase', 'expense', 'customer_receipt', 'supplier_payment',
                    'sales_refund', 'purchase_return', 'other_income', 'cash_adjustment') then
    raise exception 'Unsupported transaction type' using errcode = '22023';
  end if;

  if v_date is null or v_key is null or length(trim(v_key)) < 8 or length(v_key) > 200 then
    raise exception 'Valid business_date and idempotency_key are required' using errcode = '22023';
  end if;

  if v_type = 'cash_adjustment' then
    if v_cash_delta is null or v_cash_delta = 0 then
      raise exception 'Cash adjustment requires non-zero cash_delta_paise' using errcode = '22023';
    end if;
    if coalesce(jsonb_array_length(coalesce(p_payload->'payments', '[]'::jsonb)), 0) <> 0 then
      raise exception 'Cash adjustment must not include payment allocations' using errcode = '22023';
    end if;
    v_amount := abs(v_cash_delta);
  elsif v_amount is null or v_amount <= 0 then
    raise exception 'amount_paise must be positive' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_payload->'payments', '[]'::jsonb)) <> 'array' then
    raise exception 'payments must be an array' using errcode = '22023';
  end if;

  for v_payment in select value from jsonb_array_elements(coalesce(p_payload->'payments', '[]'::jsonb))
  loop
    if coalesce((v_payment->>'amount_paise')::bigint, 0) <= 0 then
      raise exception 'Payment amount must be positive' using errcode = '22023';
    end if;
    if v_payment->>'payment_method' not in ('cash', 'upi', 'bank', 'card', 'other') then
      raise exception 'Unsupported payment method' using errcode = '22023';
    end if;
    v_payment_total := v_payment_total + (v_payment->>'amount_paise')::bigint;
  end loop;

  if v_type in ('customer_receipt', 'supplier_payment') and v_payment_total <> v_amount then
    raise exception 'Receipt/payment allocation must equal transaction amount' using errcode = '22023';
  end if;
  if v_type not in ('customer_receipt', 'supplier_payment', 'cash_adjustment') and v_payment_total > v_amount then
    raise exception 'Payment allocations cannot exceed transaction amount' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_payload->'invoice_allocations', '[]'::jsonb)) <> 'array' then
    raise exception 'invoice_allocations must be an array' using errcode = '22023';
  end if;
  if v_type not in ('customer_receipt', 'supplier_payment')
     and jsonb_array_length(coalesce(p_payload->'invoice_allocations', '[]'::jsonb)) > 0 then
    raise exception 'Only customer receipts and supplier payments can settle invoices' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_payload->'invoice_allocations', '[]'::jsonb)) > 0 and v_party_id is null then
    raise exception 'A customer or supplier is required when allocating a settlement' using errcode = '22023';
  end if;

  v_expected_invoice_type := case when v_type = 'customer_receipt' then 'sale'
                                  when v_type = 'supplier_payment' then 'purchase'
                                  else null end;
  for v_allocation in select value from jsonb_array_elements(coalesce(p_payload->'invoice_allocations', '[]'::jsonb))
  loop
    if coalesce((v_allocation->>'amount_paise')::bigint, 0) <= 0 then
      raise exception 'Invoice allocation amount must be positive' using errcode = '22023';
    end if;
    v_allocation_total := v_allocation_total + (v_allocation->>'amount_paise')::bigint;
    if v_allocation_total > v_amount then
      raise exception 'Invoice allocations cannot exceed the settlement amount' using errcode = '22023';
    end if;

    select * into v_invoice
    from public.business_transactions
    where id = nullif(v_allocation->>'invoice_transaction_id', '')::uuid
      and business_id = v_business_id
      and transaction_type = v_expected_invoice_type
      and status = 'posted'
      and party_id = v_party_id
    for update;

    if not found then
      raise exception 'Invoice not found for this customer or supplier' using errcode = '22023';
    end if;

    select greatest(0, v_invoice.amount_paise
      - coalesce((select sum(p.amount_paise) from public.transaction_payments p
                  where p.business_id = v_business_id and p.transaction_id = v_invoice.id), 0)
      - coalesce((select sum(a.amount_paise) from public.transaction_allocations a
                  where a.business_id = v_business_id and a.invoice_transaction_id = v_invoice.id), 0))
      into v_invoice_due;

    if (v_allocation->>'amount_paise')::bigint > v_invoice_due then
      raise exception 'Invoice allocation exceeds the remaining balance' using errcode = '22023';
    end if;
  end loop;

  select * into v_existing
  from public.business_transactions
  where business_id = v_business_id and idempotency_key = v_key;

  if found then
    return v_existing;
  end if;

  v_doc_no := upper(replace(v_type, '_', '-')) || '-' ||
              to_char(v_date, 'YYYYMMDD') || '-' ||
              upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.business_transactions (
    business_id, transaction_type, status, document_no, business_date, amount_paise,
    cash_delta_paise, party_id, idempotency_key, notes, created_by, posted_at
  ) values (
    v_business_id, v_type, 'posted', v_doc_no, v_date, v_amount,
    case when v_type = 'cash_adjustment' then v_cash_delta else null end,
    v_party_id, v_key, v_notes, v_user_id, now()
  )
  returning * into v_created;

  for v_payment in select value from jsonb_array_elements(coalesce(p_payload->'payments', '[]'::jsonb))
  loop
    insert into public.transaction_payments (
      business_id, transaction_id, amount_paise, payment_method, payment_date, reference
    ) values (
      v_business_id, v_created.id,
      (v_payment->>'amount_paise')::bigint,
      v_payment->>'payment_method',
      coalesce(nullif(v_payment->>'payment_date', '')::date, v_date),
      nullif(v_payment->>'reference', '')
    );
  end loop;

  for v_allocation in select value from jsonb_array_elements(coalesce(p_payload->'invoice_allocations', '[]'::jsonb))
  loop
    insert into public.transaction_allocations (
      business_id, settlement_transaction_id, invoice_transaction_id, amount_paise
    ) values (
      v_business_id, v_created.id,
      (v_allocation->>'invoice_transaction_id')::uuid,
      (v_allocation->>'amount_paise')::bigint
    );
  end loop;

  insert into public.audit_logs (
    business_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_business_id, v_user_id, 'transaction.created', 'business_transaction', v_created.id,
    jsonb_build_object('transaction_type', v_type, 'amount_paise', v_amount, 'document_no', v_doc_no)
  );

  return v_created;
exception
  when unique_violation then
    -- Concurrent retries can race the initial idempotency lookup. Return the
    -- original transaction if the same key won; rethrow unrelated constraints.
    select * into v_existing
    from public.business_transactions
    where business_id = v_business_id and idempotency_key = v_key;
    if found then
      return v_existing;
    end if;
    raise;
end;
$;

-- The app database role invokes this function only after setting app.user_id in a transaction.
