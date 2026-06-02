# CareerOS AI Database Schema

## Purpose

This document defines an initial conceptual data model for CareerOS AI. It is not tied to a specific database technology yet. The model should support user identity, career profiles, AI memory, opportunities, applications, learning plans, market intelligence, motivation, and agent activity.

## Core Entities

### users

Stores the durable identity of each user.

Suggested fields:

- id
- email
- phone_number
- display_name
- auth_provider
- created_at
- updated_at
- last_active_at
- account_status

### user_profiles

Stores normalized professional profile data.

Suggested fields:

- id
- user_id
- headline
- summary
- current_title
- current_company
- years_experience
- location
- preferred_locations
- preferred_remote_mode
- salary_expectation_min
- salary_expectation_max
- target_industries
- target_roles
- career_goals
- created_at
- updated_at

### resumes

Stores uploaded and generated resume records.

Suggested fields:

- id
- user_id
- title
- source_type
- file_url
- parsed_content
- version
- is_primary
- created_at
- updated_at

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
- achievements
- skills_used

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
- description

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

### skills

Stores canonical skills known by the platform.

Suggested fields:

- id
- name
- category
- aliases
- description

### user_skills

Links users to skills and proficiency signals.

Suggested fields:

- id
- user_id
- skill_id
- proficiency_level
- evidence
- source
- last_validated_at

## Intelligence and Scoring Entities

### career_analyses

Stores AI-generated career analysis outputs.

Suggested fields:

- id
- user_id
- career_summary
- strengths
- weaknesses
- missing_skills
- opportunity_score
- market_readiness_score
- recommendations
- model_version
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

Stores persistent AI memory.

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
- application_history
- interview_feedback
- learning_progress
- communication_preference

## Opportunity Entities

### companies

Stores company records.

Suggested fields:

- id
- name
- website
- industry
- size
- headquarters_location
- description

### job_sources

Stores external source metadata.

Suggested fields:

- id
- name
- source_type
- base_url
- integration_status
- last_checked_at

### job_opportunities

Stores discovered roles.

Suggested fields:

- id
- source_id
- company_id
- external_id
- title
- description
- location
- remote_mode
- salary_min
- salary_max
- currency
- seniority
- employment_type
- url
- posted_at
- expires_at
- discovered_at

### opportunity_matches

Stores per-user match analysis for jobs.

Suggested fields:

- id
- user_id
- job_opportunity_id
- match_score
- match_explanation
- skill_matches
- skill_gaps
- salary_fit
- location_fit
- status
- created_at

## Application Entities

### applications

Tracks user applications.

Suggested fields:

- id
- user_id
- job_opportunity_id
- status
- priority
- applied_at
- deadline_at
- notes
- next_action
- created_at
- updated_at

Application statuses:

- saved
- preparing
- ready_for_review
- applied
- interview
- offer
- rejected
- withdrawn

### application_assets

Stores generated or uploaded application documents.

Suggested fields:

- id
- application_id
- asset_type
- title
- content
- file_url
- version
- created_by
- created_at

Asset types:

- tailored_resume
- cover_letter
- recruiter_message
- interview_plan

## Learning Entities

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

### learning_items

Stores individual courses, certifications, or practice tasks.

Suggested fields:

- id
- learning_plan_id
- title
- provider
- url
- item_type
- skill_id
- estimated_hours
- status
- due_date

## Market Intelligence Entities

### market_signals

Stores external market observations.

Suggested fields:

- id
- signal_type
- title
- summary
- source_name
- source_url
- industries
- locations
- roles
- confidence
- observed_at
- created_at

Signal types:

- hiring_trend
- layoff_trend
- salary_trend
- skill_demand
- economic_indicator
- industry_news

## Agent and Workflow Entities

### agent_tasks

Stores agent work items.

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

### agent_activity_log

Stores auditable agent actions and explanations.

Suggested fields:

- id
- user_id
- agent_task_id
- activity_type
- message
- reasoning
- input_refs
- output_refs
- created_at

### user_feedback

Stores user feedback on recommendations and agent outputs.

Suggested fields:

- id
- user_id
- target_type
- target_id
- rating
- feedback_text
- created_at

## Privacy and Retention Notes

CareerOS AI will handle sensitive personal, employment, and application data. Future implementation must define:

- Data retention periods.
- User export and deletion workflows.
- Consent records for integrations.
- Access audit logs.
- Encryption requirements.
- Redaction rules for AI prompts and logs.

