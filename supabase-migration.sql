-- Run once in Supabase SQL Editor after the original six-table setup.
-- Adds the schedule field used by the current GAINZ profile wizard.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS schedule INTEGER;

-- Ensure the Supabase Data API roles can access the tables.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.workout_plans,
  public.diet_plans,
  public.progress,
  public.workout_completions,
  public.water_tracking
TO authenticated;
