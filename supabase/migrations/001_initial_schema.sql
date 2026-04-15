-- Tourney: Americano Tournament Manager
-- Complete database schema

-- Profiles (extends Supabase Auth)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  logo_url text,
  free_tournament_used boolean not null default false,
  free_scoreboard_used boolean not null default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Tournaments
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_rounds int not null check (total_rounds in (3, 4, 5)),
  max_players int not null check (max_players in (8, 16, 32, 64)),
  status text not null default 'draft' check (status in ('draft', 'registration', 'in_progress', 'completed')),
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tournaments enable row level security;

create policy "Tournaments are viewable by everyone"
  on tournaments for select using (true);

create policy "Authenticated users can create tournaments"
  on tournaments for insert with check (auth.uid() = created_by);

create policy "Owners can update their tournaments"
  on tournaments for update using (auth.uid() = created_by);

create policy "Owners can delete their tournaments"
  on tournaments for delete using (auth.uid() = created_by);

-- Players
create table players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  gender text not null check (gender in ('male', 'female')),
  classification text not null check (classification in ('A+', 'A', 'B+', 'B', 'C+', 'C')),
  created_at timestamptz default now(),
  unique(tournament_id, name)
);

alter table players enable row level security;

create policy "Players are viewable by everyone"
  on players for select using (true);

create policy "Tournament owners can add players"
  on players for insert with check (
    auth.uid() = (select created_by from tournaments where id = tournament_id)
  );

create policy "Tournament owners can update players"
  on players for update using (
    auth.uid() = (select created_by from tournaments where id = tournament_id)
  );

create policy "Tournament owners can delete players"
  on players for delete using (
    auth.uid() = (select created_by from tournaments where id = tournament_id)
  );

-- Rounds
create table rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round_number int not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  created_at timestamptz default now(),
  unique(tournament_id, round_number)
);

alter table rounds enable row level security;

create policy "Rounds are viewable by everyone"
  on rounds for select using (true);

create policy "Tournament owners can manage rounds"
  on rounds for insert with check (
    auth.uid() = (select created_by from tournaments where id = tournament_id)
  );

create policy "Tournament owners can update rounds"
  on rounds for update using (
    auth.uid() = (select created_by from tournaments where id = tournament_id)
  );

-- Matches
create table matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  court_number int not null default 0,
  court_name text,
  team1_score int not null default 0 check (team1_score >= 0 and team1_score <= 5),
  team2_score int not null default 0 check (team2_score >= 0 and team2_score <= 5),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  created_at timestamptz default now(),
  constraint score_sum_five check (
    status != 'completed' or (team1_score + team2_score = 5)
  )
);

alter table matches enable row level security;

create policy "Matches are viewable by everyone"
  on matches for select using (true);

create policy "Tournament owners can create matches"
  on matches for insert with check (
    auth.uid() = (
      select t.created_by from tournaments t
      join rounds r on r.tournament_id = t.id
      where r.id = round_id
    )
  );

create policy "Tournament owners can update matches"
  on matches for update using (
    auth.uid() = (
      select t.created_by from tournaments t
      join rounds r on r.tournament_id = t.id
      where r.id = round_id
    )
  );

-- Match Players (maps players to teams in matches)
create table match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  team int not null check (team in (1, 2)),
  unique(match_id, player_id)
);

alter table match_players enable row level security;

create policy "Match players are viewable by everyone"
  on match_players for select using (true);

create policy "Tournament owners can create match players"
  on match_players for insert with check (
    auth.uid() = (
      select t.created_by from tournaments t
      join rounds r on r.tournament_id = t.id
      join matches m on m.round_id = r.id
      where m.id = match_id
    )
  );

-- Scoreboards (Tennis & Padel)
create table scoreboards (
  id uuid primary key default gen_random_uuid(),
  player1_name text not null,
  player2_name text not null,
  best_of int not null default 3 check (best_of in (3, 5)),
  format text not null default 'standard' check (format in ('standard', 'junior')),
  sport_type text not null default 'tennis' check (sport_type in ('tennis', 'padel')),
  golden_point boolean not null default false,
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

-- Payments
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_type text not null check (item_type in ('tournament', 'scoreboard')),
  amount_kobo bigint not null,
  currency text not null default 'NGN' check (currency = 'NGN'),
  paystack_reference text unique not null,
  paystack_access_code text,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  item_metadata jsonb,
  created_item_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table payments enable row level security;

create policy "Users can view own payments"
  on payments for select using (auth.uid() = user_id);

create policy "Users can insert own payments"
  on payments for insert with check (auth.uid() = user_id);

-- Enable Realtime for live public updates
alter publication supabase_realtime add table tournaments;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table scoreboards;
