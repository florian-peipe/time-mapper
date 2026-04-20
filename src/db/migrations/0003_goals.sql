-- Per-place time targets. Both columns are nullable — null means "no goal
-- set", so existing rows keep their current "no target" behavior. Values
-- are whole minutes (consistent with the rest of the domain, which stores
-- durations in seconds or minutes rather than a time unit crate).
--
-- daily_goal_minutes  — e.g. 480 for an 8h/day target.
-- weekly_goal_minutes — e.g. 2400 for a 40h/week target.
--
-- Goal-reached notifications compare against these when an entry closes;
-- the Stats page also renders progress bars + overtime when a goal is set.

ALTER TABLE `places` ADD COLUMN `daily_goal_minutes` integer;
--> statement-breakpoint
ALTER TABLE `places` ADD COLUMN `weekly_goal_minutes` integer;
