-- Ensure compatibility columns/tables for legacy code paths

-- activities.method alias column to mirror existing "type"
alter table activities
  add column if not exists method text;
update activities set method = type where method is null and type is not null;

-- appointments.user_id alias of assigned_to
alter table appointments
  add column if not exists user_id uuid;
update appointments set user_id = assigned_to where user_id is null and assigned_to is not null;

-- targets.type column for AB/VAS lookups
alter table targets
  add column if not exists type text;
update targets set type = 'AB' where type is null;

-- Provide a followups view to mirror follow_ups table if missing
do $$
begin
  if not exists (select 1 from information_schema.views where table_name = 'followups') then
    execute 'create view followups as select * from follow_ups';
  end if;
end$$;
