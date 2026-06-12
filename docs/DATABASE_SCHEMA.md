# CareerOS Database Schema

## Purpose

This document defines the conceptual data model for CareerOS. The active schema is implemented in PostgreSQL using Drizzle ORM, with committed migrations in `packages/database/migrations`.

The model supports user identity, career profiles, AI memory, opportunities, applications, learning plans, market intelligence, motivation, and agent activity.

## Technology

- **Database**: PostgreSQL (Docker locally, managed provider for production).
- **ORM**: Drizzle ORM.
- **Auth**: Better Auth — owns `user`, `session`, `account`, `verification` tables.
- **Domain tables**: reference CareerOS app-owned `users.id`, not the auth provider's user ID.

## Identity

### users (CareerOS-owned)

Application identity, separate from auth provider identity.

Suggested fields:

- id (uuid, primary key)
- email (text, not null)
- email_verified_at (timestamptz, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)

### auth_identities

Maps auth provider identity to CareerOS app identity.

Suggested fields:

- id
- user_id (references users.id)
- provider (text: `better_auth`)
- provider_subject (text: Better Auth user.id)
- provider_profile (jsonb: minimal metadata only)
- created_at

### Better Auth tables (auth-owned)

- `user`
- `session`
- `account`
- `verification`

Domain tables always reference CareerOS `users.id`, not Better Auth `user.id`.

## Career Profile Entities

### profiles

Stores the user's career profile.

Suggested fields:

- id
- user_id
- full_name
- headline
- current_title
- current_company
- location
- target_role
- target_industries (jsonb)
- preferred_locations (jsonb)
- remote_preference
- salary_expectation (jsonb)
- years_experience
- career_goal
- created_at
- updated_at

### career_profiles

Stores richer career profile data from onboarding.

Suggested fields:

- id
- user_id
- career_summary
- experience_level
- primary_skills (jsonb)
- industry_focus
- onboarding_status
- created_at
- updated_at

### resumes

Stores uploaded and generated resume records.

Suggested fields:

- id
- user_id
- title
- source_type
- file_path (object storage reference)
- parsed_text
- summary
- parse_status
- version
- is_primary
- created_at
- updated_at

### linkedin_profiles

Stores LinkedIn profile input from paste/import.

Suggested fields:

- id
- user_id
- source_type (pasted_text, profile_url, manual)
- raw_text
- parsed_summary
- imported_at

### experiences

Stores work history.

Suggested fields:

- id
- user_id
- company
- title
- location
- start_date
- end_date
- is_current
- description
- achievements (jsonb)
- skills_used (jsonb)

### education

Stores formal education.

Suggested fields:

- id
- user_id
- institution
- qualification
- field_of_study
- start_date
- end_date
- location

### certifications

Stores certifications and credentials.

Suggested fields:

- id
- user_id
- name
- issuer
- issued_at
- expires_at
- credential_url
- status

### user_skills

Links users to extracted or confirmed skills.

Suggested fields:

- id
- user_id
- name
- source
- proficiency_level
- evidence
- confidence
- created_at

## Intelligence and Scoring Entities

### career_reports

Stores AI-generated career analysis outputs.

Suggested fields:

- id
- user_id
- career_summary
- niche_assessment_status (supported, challenged, redirected)
- niche_assessment_evidence (jsonb)
- strengths (jsonb)
- weaknesses (jsonb)
- missing_skills (jsonb)
- readiness_score
- opportunity_score
- career_system_prescription (jsonb)
- recommendations (jsonb)
- model_name
- prompt_version
- market_data_snapshot_date
- status (generating, ready, failed)
- created_at

### career_goals

Stores explicit user goals.

Suggested fields:

- id
- user_id
- goal_type
- title
- description
- target_date
- priority
- status
- created_at
- updated_at

### ai_memories

Stores persistent Scout memory.

Suggested fields:

- id
- user_id
- memory_type
- key
- value
- source
- confidence
- is_user_editable
- created_at
- updated_at

Memory types:

- explicit_preference
- inferred_preference
- career_fact
- niche_validation_result
- application_history
- interview_feedback
- learning_progress
- networking_target
- communication_preference

## Opportunity Entities

### jobs

Stores discovered or imported jobs.

Suggested fields:

- id
- source
- external_id
- title
- company
- location
- remote_mode
- description
- url
- salary_text
- salary_min (numeric, nullable)
- salary_max (numeric, nullable)
- currency
- seniority
- employment_type
- required_skills (jsonb)
- posted_at
- expires_at
- discovered_at
- raw_payload (jsonb, original source payload)

### job_recommendations

Stores per-user job match analysis.

Suggested fields:

- id
- user_id
- job_id
- match_score
- matched_skills (jsonb)
- missing_skills (jsonb)
- explanation
- status (new, viewed, saved, rejected)
- created_at

### saved_jobs

Stores user-saved jobs.

Suggested fields:

- id
- user_id
- job_id
- saved_at

## Application Entities

### applications

Tracks user applications.

Suggested fields:

- id
- user_id
- job_id (nullable for manual entries)
- company
- title
- url
- status (saved, preparing, applied, interview, offer, rejected, withdrawn)
- priority
- notes
- next_action
- deadline_at
- applied_at
- created_at
- updated_at

### application_assets

Stores generated or uploaded application documents.

Suggested fields:

- id
- application_id
- asset_type (tailored_resume, cover_letter, recruiter_message, interview_plan)
- title
- content
- version
- approval_status
- approved_at
- created_at

### approval_requests

Tracks user approvals for sensitive external actions.

Suggested fields:

- id
- user_id
- action_type
- action_description
- content_preview
- destination
- status (pending, approved, denied)
- approved_at
- denied_at
- created_at

## Learning Entities

### learning_recommendations

Stores learning recommendations generated from skill gaps.

Suggested fields:

- id
- user_id
- skill_name
- item_type (course, certification, portfolio_project, github_repo, case_study)
- title
- provider
- url
- reason
- market_demand_basis
- estimated_time
- status (recommended, saved, completed, dismissed)
- created_at

### learning_plans

Stores structured learning plans.

Suggested fields:

- id
- user_id
- title
- target_role
- objective
- status
- start_date
- target_completion_date
- created_at
- updated_at

## Market Intelligence Entities

### market_signals

Stores external market observations.

Suggested fields:

- id
- signal_type (hiring_trend, layoff_trend, salary_trend, skill_demand, economic_indicator, geopolitical_signal, industry_news)
- title
- summary
- source_name
- source_url
- publication_date
- observed_at
- industries (jsonb)
- locations (jsonb)
- roles (jsonb)
- confidence
- created_at

## Agent and Workflow Entities

### agent_tasks

Stores Scout work items.

Suggested fields:

- id
- user_id
- task_type
- title
- description
- status
- priority
- requires_approval
- approved_at
- completed_at
- result_summary
- created_at
- updated_at

### agent_messages

Stores Scout conversation messages.

Suggested fields:

- id
- user_id
- role (user, scout, system)
- content
- context_summary
- created_at

### events

Stores product and system events.

Suggested fields:

- id
- user_id (nullable for system events)
- event_type
- entity_type
- entity_id (nullable)
- payload (jsonb — small metadata only, no sensitive content)
- created_at

## Privacy and Retention Notes

CareerOS handles sensitive personal, career, and application data. Implementation must define:

- Data retention periods by category.
- User export and deletion workflows.
- Consent records for integrations.
- Access audit logs.
- Encryption requirements.
- Redaction rules for AI prompts and logs — raw resume text, LinkedIn text, and prompt content must never appear in logs.
