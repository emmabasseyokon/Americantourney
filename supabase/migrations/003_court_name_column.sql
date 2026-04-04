-- Add court_name text column (nullable) to support named courts like "Centre Court"
-- court_number 0 = unassigned, 1-7 = Court 1-7
-- court_name overrides court_number display when set (e.g. "Centre Court")

alter table matches alter column court_number set default 0;
alter table matches add column court_name text;
