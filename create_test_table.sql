-- Create table for transactions_test (Exact copy for local testing)
create table if not exists transactions_test (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  description text not null,
  amount numeric not null,
  date date not null default current_date,
  category text,
  paid_by text not null check (paid_by in ('Douglas', 'Lara')),
  is_shared boolean default true,
  split_type text default 'equal',
  share_douglas numeric,
  share_lara numeric,
  raw_input text
);

-- Enable RLS
alter table transactions_test enable row level security;

-- Create policy to allow all access (for development/personal use simplifed)
create policy "Allow public access test" on transactions_test
  for all using (true) with check (true);
