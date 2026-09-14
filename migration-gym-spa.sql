-- ===================================================================
--  Gate to Gate — gym rebuild, spa scheduling and the goal change
--
--  Run once in the Neon SQL Editor. Additive and safe to re-run.
-- ===================================================================

-- --- gym opening hours ---------------------------------------------
-- The planner will not place a session or a spa block outside these.
alter table settings add column if not exists gym_open  text not null default '06:00';
alter table settings add column if not exists gym_close text not null default '22:00';

update settings set gym_open = '06:00', gym_close = '22:00' where id = 1;

-- --- the strength goal ---------------------------------------------
-- A 150 kg leg press measures a machine. A trap bar deadlift measures
-- the thing that actually gets you out of a start gate, and it is the
-- lift the whole autumn is built around. Milestones follow the real
-- progression: 50 kg technical, then 2.5 kg a week.
update goals set
  title        = 'Trap bar deadlift — 100 kg',
  slug         = 'trapbar-100',
  metric       = 'Top working set for 6',
  unit         = 'kg',
  start_value  = 50,
  current_value = 50,
  target_value = 100,
  target_date  = '2026-12-25',
  lower_better = false
where slug = 'legpress-150';

delete from goal_milestones
where goal_id = (select id from goals where slug = 'trapbar-100');

insert into goal_milestones (goal_id, label, value, sort)
select g.id, m.label, m.value, m.sort
from goals g
join (values
  ('60 kg — past the technical fortnight', 60::numeric, 1),
  ('70 kg', 70, 2),
  ('80 kg — bodyweight', 80, 3),
  ('90 kg', 90, 4),
  ('100 kg by Christmas', 100, 5)
) as m (label, value, sort) on true
where g.slug = 'trapbar-100';
