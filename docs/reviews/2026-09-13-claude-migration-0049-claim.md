# Claude claims migration 0049

`0049_project_track` — adds `project_runs.career_profile_id` (uuid, references `career_profiles.id`
on delete set null) with an index on (user_id, career_profile_id). Projects were not scoped to a
career direction: after switching from SOC Analyst to IT System Administrator the owner still saw
SOC projects. Generated with drizzle-kit, verified on a throwaway database first.
