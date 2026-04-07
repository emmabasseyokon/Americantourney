-- Tennis Scoreboards
create table scoreboards (
  id uuid primary key default gen_random_uuid(),
  player1_name text not null,
  player2_name text not null,
  best_of int not null default 3 check (best_of in (3, 5)),
  score_state jsonb not null default '{
    "sets": [],
    "currentSet": { "p1": 0, "p2": 0 },
    "currentGame": { "p1": "0", "p2": "0" },
    "isTiebreak": false,
    "tiebreak": { "p1": 0, "p2": 0 },
    "server": 1
  }'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  winner int check (winner in (1, 2)),
  court_name text,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table scoreboards enable row level security;

create policy "Scoreboards are viewable by everyone"
  on scoreboards for select using (true);

create policy "Authenticated users can create scoreboards"
  on scoreboards for insert with check (auth.uid() = created_by);

create policy "Owners can update their scoreboards"
  on scoreboards for update using (auth.uid() = created_by);

create policy "Owners can delete their scoreboards"
  on scoreboards for delete using (auth.uid() = created_by);

-- Enable Realtime
alter publication supabase_realtime add table scoreboards;
