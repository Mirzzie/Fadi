-- Adds first-class MVP Career Intelligence Report sections.

alter table public.career_reports
add column if not exists strengths jsonb not null default '[]'::jsonb,
add column if not exists target_role_fit jsonb not null default '{}'::jsonb;

comment on column public.career_reports.strengths is
  'AI-generated user strengths for the MVP Career Intelligence Report.';

comment on column public.career_reports.target_role_fit is
  'AI-generated assessment of how the user fits the selected target role.';
