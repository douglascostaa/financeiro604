-- Create table for transactions
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  description text not null,
  amount numeric not null,
  date date not null default current_date,
  category text,
  paid_by text not null check (paid_by in ('Douglas', 'Lara')),
  is_shared boolean default true,
  split_type text default 'equal', -- 'equal' or 'custom'
  share_douglas numeric, -- Amount stored for Douglas share in custom split
  share_lara numeric,    -- Amount stored for Lara share in custom split
  raw_input text -- original text from chat
);

-- Enable Row Level Security (RLS)
alter table transactions enable row level security;

-- Create policy to allow all access (for development/personal use simplifed)
-- In production, you would tie this to auth.uid()
create policy "Allow public access" on transactions
  for all using (true) with check (true);
