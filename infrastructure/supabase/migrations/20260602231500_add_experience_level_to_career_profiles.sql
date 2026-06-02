-- Adds the MVP onboarding experience level field to career_profiles.

alter table public.career_profiles
add column if not exists experience_level text
  check (
    experience_level is null
    or experience_level in ('entry', 'mid', 'senior', 'lead', 'executive', 'career_switcher')
  );

comment on column public.career_profiles.experience_level is
  'User-selected MVP experience level captured during onboarding.';
