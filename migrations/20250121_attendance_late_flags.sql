-- Add late flags to attendance
alter table attendance
  add column if not exists late_checkin boolean not null default false,
  add column if not exists late_checkout boolean not null default false,
  add column if not exists is_late boolean not null default false;

update attendance
   set late_checkin = coalesce(late_checkin, false),
       late_checkout = coalesce(late_checkout, false),
       is_late = coalesce(is_late, false)
 where 1=1;
