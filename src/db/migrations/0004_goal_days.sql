-- Per-day filter for the daily goal. When null (the default and only
-- option for rows that existed before this migration), the daily goal
-- applies every day — same behavior as before. When set, the value is
-- a comma-separated list of ISO day numbers (1 = Mon … 7 = Sun); only
-- those days count toward the daily-goal crossing (and fire a goal
-- notification on). Example: "1,2,3,4,5" = Mon–Fri only.
--
-- Weekly goal deliberately has no per-day filter — the concept
-- ("minutes per ISO week") doesn't admit a meaningful per-day subset.

ALTER TABLE `places` ADD COLUMN `daily_goal_days` text;
