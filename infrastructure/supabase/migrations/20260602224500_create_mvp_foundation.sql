-- CareerOS AI MVP database foundation.
-- This migration creates the secure user-owned data model for onboarding,
-- resume upload, LinkedIn profile storage, reports, jobs, applications,
-- learning recommendations, and assistant messages.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Maintains updated_at timestamps for mutable CareerOS AI tables.';

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_id_key unique (user_id)
);

comment on table public.profiles is
  'Stores one application-level profile record per authenticated CareerOS AI user.';
comment on column public.profiles.user_id is
  'Owner of this profile. References auth.users and is enforced by RLS.';

create table public.career_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  headline text,
  current_title text,
  current_company text,
  location text,
  target_role text,
  target_industries jsonb not null default '[]'::jsonb,
  preferred_locations jsonb not null default '[]'::jsonb,
  remote_preference text check (remote_preference in ('remote', 'hybrid', 'onsite', 'flexible')),
  salary_expectation text,
  years_experience numeric(4, 1) check (years_experience is null or years_experience >= 0),
  career_goal text,
  skills jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.career_profiles is
  'Stores confirmed career profile details used for MVP analysis and recommendations.';

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid references public.career_profiles(id) on delete set null,
  file_path text not null,
  file_name text not null,
  file_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  parsed_text text,
  summary text,
  parse_status text not null default 'pending'
    check (parse_status in ('pending', 'processing', 'parsed', 'failed')),
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.resumes is
  'Stores resume upload metadata, parsed text, and summary for a user.';

create table public.linkedin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid references public.career_profiles(id) on delete set null,
  source_type text not null default 'pasted_text'
    check (source_type in ('pasted_text', 'profile_url', 'manual')),
  profile_url text,
  raw_text text,
  parsed_summary text,
  parsed_skills jsonb not null default '[]'::jsonb,
  import_status text not null default 'pending'
    check (import_status in ('pending', 'parsed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.linkedin_profiles is
  'Stores LinkedIn profile text or URL context provided by the user during onboarding.';

create table public.career_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  career_profile_id uuid references public.career_profiles(id) on delete set null,
  resume_id uuid references public.resumes(id) on delete set null,
  linkedin_profile_id uuid references public.linkedin_profiles(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'ready', 'failed')),
  career_summary text,
  skill_analysis jsonb not null default '[]'::jsonb,
  missing_skills jsonb not null default '[]'::jsonb,
  career_opportunities jsonb not null default '[]'::jsonb,
  market_demand jsonb not null default '{}'::jsonb,
  recommended_learning_path jsonb not null default '[]'::jsonb,
  resume_quality_score integer
    check (resume_quality_score is null or resume_quality_score between 0 and 100),
  career_readiness_score integer
    check (career_readiness_score is null or career_readiness_score between 0 and 100),
  recommended_actions jsonb not null default '[]'::jsonb,
  model_name text,
  prompt_version text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.career_reports is
  'Stores the first Career Intelligence Report and future report versions for a user.';

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'manual',
  external_id text,
  title text not null,
  company text not null,
  location text,
  remote_mode text check (remote_mode in ('remote', 'hybrid', 'onsite', 'unknown')),
  description text,
  url text,
  salary_text text,
  posted_at timestamptz,
  discovered_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_id_user_id_key unique (id, user_id),
  constraint jobs_user_source_external_unique unique (user_id, source, external_id)
);

comment on table public.jobs is
  'Stores user-owned job opportunities discovered, imported, or manually added in the MVP.';

create table public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null,
  match_score integer check (match_score is null or match_score between 0 and 100),
  matched_skills jsonb not null default '[]'::jsonb,
  missing_skills jsonb not null default '[]'::jsonb,
  explanation text,
  status text not null default 'saved'
    check (status in ('new', 'viewed', 'saved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_jobs_job_owner_fk foreign key (job_id, user_id)
    references public.jobs(id, user_id) on delete cascade,
  constraint saved_jobs_user_job_key unique (user_id, job_id)
);

comment on table public.saved_jobs is
  'Stores per-user job recommendation state, match explanation, and save/reject feedback.';

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid,
  company text not null,
  title text not null,
  url text,
  status text not null default 'saved'
    check (status in ('saved', 'preparing', 'applied', 'interview', 'offer', 'rejected', 'withdrawn')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  notes text,
  next_action text,
  deadline_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_job_owner_fk foreign key (job_id, user_id)
    references public.jobs(id, user_id) on delete cascade
);

comment on table public.applications is
  'Stores manual application tracking records for a user.';

create table public.learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  career_report_id uuid references public.career_reports(id) on delete set null,
  skill_name text not null,
  title text not null,
  provider text,
  url text,
  reason text,
  estimated_time text,
  status text not null default 'recommended'
    check (status in ('recommended', 'saved', 'completed', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.learning_recommendations is
  'Stores skill-gap based learning recommendations for a user.';

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  context_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.agent_messages is
  'Stores MVP AI career assistant conversation messages and lightweight context summaries.';

create index profiles_user_id_idx on public.profiles(user_id);
create index profiles_onboarding_status_idx on public.profiles(onboarding_status);

create index career_profiles_user_id_idx on public.career_profiles(user_id);
create index career_profiles_target_role_idx on public.career_profiles(target_role);

create index resumes_user_id_idx on public.resumes(user_id);
create index resumes_parse_status_idx on public.resumes(parse_status);
create index resumes_user_primary_idx on public.resumes(user_id, is_primary);

create index linkedin_profiles_user_id_idx on public.linkedin_profiles(user_id);
create index linkedin_profiles_import_status_idx on public.linkedin_profiles(import_status);

create index career_reports_user_id_idx on public.career_reports(user_id);
create index career_reports_status_idx on public.career_reports(status);
create index career_reports_user_created_at_idx on public.career_reports(user_id, created_at desc);

create index jobs_user_id_idx on public.jobs(user_id);
create index jobs_source_idx on public.jobs(source);
create index jobs_company_idx on public.jobs(company);
create index jobs_title_idx on public.jobs(title);
create index jobs_discovered_at_idx on public.jobs(discovered_at desc);

create index saved_jobs_user_id_idx on public.saved_jobs(user_id);
create index saved_jobs_job_id_idx on public.saved_jobs(job_id);
create index saved_jobs_status_idx on public.saved_jobs(status);

create index applications_user_id_idx on public.applications(user_id);
create index applications_job_id_idx on public.applications(job_id);
create index applications_status_idx on public.applications(status);
create index applications_deadline_at_idx on public.applications(deadline_at);

create index learning_recommendations_user_id_idx on public.learning_recommendations(user_id);
create index learning_recommendations_status_idx on public.learning_recommendations(status);
create index learning_recommendations_skill_name_idx on public.learning_recommendations(skill_name);

create index agent_messages_user_id_idx on public.agent_messages(user_id);
create index agent_messages_role_idx on public.agent_messages(role);
create index agent_messages_user_created_at_idx on public.agent_messages(user_id, created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger career_profiles_set_updated_at
before update on public.career_profiles
for each row execute function public.set_updated_at();

create trigger resumes_set_updated_at
before update on public.resumes
for each row execute function public.set_updated_at();

create trigger linkedin_profiles_set_updated_at
before update on public.linkedin_profiles
for each row execute function public.set_updated_at();

create trigger career_reports_set_updated_at
before update on public.career_reports
for each row execute function public.set_updated_at();

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create trigger saved_jobs_set_updated_at
before update on public.saved_jobs
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create trigger learning_recommendations_set_updated_at
before update on public.learning_recommendations
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.career_profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.linkedin_profiles enable row level security;
alter table public.career_reports enable row level security;
alter table public.jobs enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.applications enable row level security;
alter table public.learning_recommendations enable row level security;
alter table public.agent_messages enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (user_id = auth.uid());

create policy "profiles_insert_own"
on public.profiles for insert
with check (user_id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "profiles_delete_own"
on public.profiles for delete
using (user_id = auth.uid());

create policy "career_profiles_select_own"
on public.career_profiles for select
using (user_id = auth.uid());

create policy "career_profiles_insert_own"
on public.career_profiles for insert
with check (user_id = auth.uid());

create policy "career_profiles_update_own"
on public.career_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "career_profiles_delete_own"
on public.career_profiles for delete
using (user_id = auth.uid());

create policy "resumes_select_own"
on public.resumes for select
using (user_id = auth.uid());

create policy "resumes_insert_own"
on public.resumes for insert
with check (user_id = auth.uid());

create policy "resumes_update_own"
on public.resumes for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "resumes_delete_own"
on public.resumes for delete
using (user_id = auth.uid());

create policy "linkedin_profiles_select_own"
on public.linkedin_profiles for select
using (user_id = auth.uid());

create policy "linkedin_profiles_insert_own"
on public.linkedin_profiles for insert
with check (user_id = auth.uid());

create policy "linkedin_profiles_update_own"
on public.linkedin_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "linkedin_profiles_delete_own"
on public.linkedin_profiles for delete
using (user_id = auth.uid());

create policy "career_reports_select_own"
on public.career_reports for select
using (user_id = auth.uid());

create policy "career_reports_insert_own"
on public.career_reports for insert
with check (user_id = auth.uid());

create policy "career_reports_update_own"
on public.career_reports for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "career_reports_delete_own"
on public.career_reports for delete
using (user_id = auth.uid());

create policy "jobs_select_own"
on public.jobs for select
using (user_id = auth.uid());

create policy "jobs_insert_own"
on public.jobs for insert
with check (user_id = auth.uid());

create policy "jobs_update_own"
on public.jobs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "jobs_delete_own"
on public.jobs for delete
using (user_id = auth.uid());

create policy "saved_jobs_select_own"
on public.saved_jobs for select
using (user_id = auth.uid());

create policy "saved_jobs_insert_own"
on public.saved_jobs for insert
with check (user_id = auth.uid());

create policy "saved_jobs_update_own"
on public.saved_jobs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "saved_jobs_delete_own"
on public.saved_jobs for delete
using (user_id = auth.uid());

create policy "applications_select_own"
on public.applications for select
using (user_id = auth.uid());

create policy "applications_insert_own"
on public.applications for insert
with check (user_id = auth.uid());

create policy "applications_update_own"
on public.applications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "applications_delete_own"
on public.applications for delete
using (user_id = auth.uid());

create policy "learning_recommendations_select_own"
on public.learning_recommendations for select
using (user_id = auth.uid());

create policy "learning_recommendations_insert_own"
on public.learning_recommendations for insert
with check (user_id = auth.uid());

create policy "learning_recommendations_update_own"
on public.learning_recommendations for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "learning_recommendations_delete_own"
on public.learning_recommendations for delete
using (user_id = auth.uid());

create policy "agent_messages_select_own"
on public.agent_messages for select
using (user_id = auth.uid());

create policy "agent_messages_insert_own"
on public.agent_messages for insert
with check (user_id = auth.uid());

create policy "agent_messages_delete_own"
on public.agent_messages for delete
using (user_id = auth.uid());
