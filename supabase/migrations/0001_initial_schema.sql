-- Dukaan Saathi MVP schema
-- Apply with the Supabase CLI after linking a project. This migration intentionally
-- keeps all financial writes business-scoped and uses integer paise for money.

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
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
  created_by uuid not null references auth.users(id) on delete restrict,
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

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null,
  transaction_id uuid,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  reason text not null check (reason in ('purchase', 'sale', 'sales_return', 'purchase_return', 'adjustment', 'opening_stock')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
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
  closed_by uuid not null references auth.users(id) on delete restrict,
  closed_at timestamptz not null default now(),
  unique (business_id, business_date)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_business_created_idx
  on public.audit_logs (business_id, created_at desc);

-- RLS: the MVP permits only the authenticated owner. Multi-user membership is deferred.
alter table public.businesses enable row level security;
alter table public.parties enable row level security;
alter table public.products enable row level security;
alter table public.business_transactions enable row level security;
alter table public.transaction_lines enable row level security;
alter table public.transaction_payments enable row level security;
alter table public.stock_movements enable row level security;
alter table public.daily_closings enable row level security;
alter table public.audit_logs enable row level security;

create policy businesses_owner_select on public.businesses
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy businesses_owner_insert on public.businesses
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy businesses_owner_update on public.businesses
  for update to authenticated using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy parties_owner_all on public.parties
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())));

create policy products_owner_all on public.products
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())));

create policy transactions_owner_all on public.business_transactions
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())));

create policy transaction_lines_owner_all on public.transaction_lines
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())));

create policy transaction_payments_owner_all on public.transaction_payments
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())));

create policy stock_movements_owner_all on public.stock_movements
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())));

create policy daily_closings_owner_all on public.daily_closings
  for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())));

create policy audit_logs_owner_select on public.audit_logs
  for select to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())));
create policy audit_logs_owner_insert on public.audit_logs
  for insert to authenticated
  with check (
    actor_user_id = (select auth.uid()) and
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid()))
  );

-- A single RPC inserts the transaction and its payments atomically. It is deliberately
-- a narrow first API; item lines and stock movements will be included in the next step.
create or replace function public.create_business_transaction(p_payload jsonb)
returns public.business_transactions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid := (p_payload->>'business_id')::uuid;
  v_type text := p_payload->>'transaction_type';
  v_date date := (p_payload->>'business_date')::date;
  v_amount bigint := (p_payload->>'amount_paise')::bigint;
  v_party_id uuid := nullif(p_payload->>'party_id', '')::uuid;
  v_key text := p_payload->>'idempotency_key';
  v_notes text := nullif(p_payload->>'notes', '');
  v_cash_delta bigint := nullif(p_payload->>'cash_delta_paise', '')::bigint;
  v_payment_total bigint := 0;
  v_payment jsonb;
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

grant execute on function public.create_business_transaction(jsonb) to authenticated;
