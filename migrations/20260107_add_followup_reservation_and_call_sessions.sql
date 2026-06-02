-- Ensure Follow The Customer additional details columns exist
alter table follow_ups
  add column if not exists reservation_type text,
  add column if not exists talk_time_seconds int not null default 0;

update follow_ups
  set talk_time_seconds = 0
where talk_time_seconds is null;

-- Keep the followups view aligned with the base table (used in a few legacy queries)
drop view if exists followups;
create view followups as select * from follow_ups;

-- Call session tracking (app/provider tracked calls)
create table if not exists call_sessions (
  id varchar primary key default gen_random_uuid(),
  user_id varchar not null,
  customer_id varchar null,
  lead_id text null,
  followup_id varchar null,
  reservation_type text not null,
  direction text not null default 'outbound',
  status text not null,
  started_at timestamptz not null,
  ended_at timestamptz null,
  duration_seconds int not null default 0,
  provider text null,
  provider_call_id text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_call_sessions_user_started on call_sessions(user_id, started_at);
create index if not exists idx_call_sessions_followup on call_sessions(followup_id);
create unique index if not exists uq_call_sessions_provider_call on call_sessions(provider_call_id) where provider_call_id is not null;

-- Align column types in case an earlier table creation used uuid columns
alter table call_sessions
  alter column id type varchar using id::varchar,
  alter column user_id type varchar using user_id::varchar,
  alter column customer_id type varchar using customer_id::varchar,
  alter column followup_id type varchar using followup_id::varchar;
