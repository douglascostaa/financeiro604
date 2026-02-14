create table if not exists recurring_expenses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  amount numeric not null,
  category text not null,
  paid_by text not null,
  day_of_month integer not null, -- Day to generate the transaction
  is_shared boolean default true,
  split_type text default 'equal',
  share_douglas numeric,
  share_lara numeric,
  active boolean default true,
  last_generated_date date
);

alter table recurring_expenses enable row level security;

create policy "Allow public access recurring" on recurring_expenses
  for all using (true) with check (true);
