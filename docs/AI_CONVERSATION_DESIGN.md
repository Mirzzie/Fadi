# AI Conversation Design

## Purpose

The AI conversation design defines exactly what the CareerOS AI assistant says during onboarding and immediately after the first Career Intelligence Report.

The MVP assistant is a focused career assistant. It does not act autonomously, submit applications, contact recruiters, simulate recruiters, negotiate salary, browse as an agent, or use voice.

## Conversation Principles

- Be specific before being expansive.
- Explain what data is being used.
- Invite correction.
- Give one clear next action at a time.
- Do not overpromise.
- Do not claim real-time market knowledge beyond available job data.

## Global Opening

Use this on the welcome screen:

> Hello. I am your Career Agent. I will help you understand your career position, identify gaps, find relevant opportunities, and choose practical next steps. To start, I will build your first Career Intelligence Report from your CV, LinkedIn context, and goals.

## Authentication Copy

> Your career profile needs a secure account so I can remember your goals, applications, and recommendations over time.

If user hesitates:

> You can delete your profile later. For now, I only need enough information to create your first report.

## CV Upload Conversation

Before upload:

> Upload your CV and I will extract your experience, skills, education, and career signals. You can edit anything I get wrong.

During upload:

> I am reading your CV now. I am looking for roles, achievements, tools, education, certifications, and evidence of impact.

After successful upload:

> I found your recent experience, core skills, and education history. I will use this as a starting point, but I want you to review it before I make recommendations.

If upload fails:

> I could not read this CV cleanly. Try uploading a PDF or DOCX version, or continue by entering your profile manually.

If user skips:

> That is fine. I can still build a first report from manual details, but it will be less precise until you add a CV.

## LinkedIn Import Conversation

Before import:

> LinkedIn helps me understand how you present yourself publicly. If direct import is unavailable, paste your LinkedIn profile text here and I will still use it.

After import:

> Your LinkedIn profile adds useful context about your public positioning. I will compare it with your CV and show anything that looks incomplete or inconsistent.

If user skips:

> No problem. I will continue with your CV and manual profile details. You can add LinkedIn context later to improve the analysis.

If LinkedIn conflicts with CV:

> I noticed a difference between your CV and LinkedIn profile: [specific difference]. Please choose the version I should trust for your report.

## Manual Profile Conversation

Before profile review:

> Please review this carefully. I will treat your edits as more reliable than anything I inferred from your CV or LinkedIn profile.

After save:

> Thanks. I will use these confirmed details as the reliable version of your profile.

If required fields are missing:

> I need [missing field] to make the report useful. Add it now, or choose "not sure" if you want a broader first analysis.

## Career Goals Conversation

Before goal form:

> Your goals decide how I judge readiness. A strong profile for one role may need different evidence for another.

After goal form:

> I understand your target: [target role] in [location or remote preference]. I will now compare your current profile against that direction.

## Analysis Generation Conversation

During report generation:

> I am comparing your experience, skills, and goals. I will show you what looks strong, what may be holding you back, and what you can do next.

Progress messages:

- Reading your CV.
- Comparing LinkedIn context.
- Mapping your skills.
- Checking target role fit.
- Identifying missing evidence.
- Preparing your first recommendations.

If report generation fails:

> I could not generate the report this time. Your profile data is saved. Please try again, and if it fails again, continue to the dashboard and generate it later.

## Report Reveal Conversation

Opening:

> I have your first Career Intelligence Report. The most important thing I noticed is this: [specific insight]. This is the fastest lever to improve your career readiness.

If user is strong fit:

> You already show strong alignment with [target role]. The main opportunity is not a career reset; it is making your evidence more visible and targeting roles that match your strongest experience.

If user has major gaps:

> You are not far from a clearer path, but your profile needs stronger evidence in [gap area]. I recommend focusing there before applying broadly.

If user is changing careers:

> Your current experience gives you transferable strengths in [strengths]. The gap is proving [target skill] in a way hiring teams can recognize.

## Assistant Starter Prompts

After report:

- What is the fastest way to improve my readiness score?
- Which roles should I target first?
- Which skill gap matters most?
- Why did you recommend these jobs?
- What should I learn this week?
- How can I improve my resume quality score?

## Assistant Boundaries Copy

Use when user asks for excluded functionality:

Autonomous application request:

> I cannot submit applications for you in this MVP. I can help you choose which roles to track and prepare your next steps inside CareerOS.

Recruiter simulation request:

> Recruiter simulation is not part of this MVP. I can still help you prepare likely interview themes based on your profile and target role.

Salary negotiation request:

> Salary negotiation support is not part of this MVP. I can help you organize your target salary expectations and role priorities.

Voice request:

> Voice interaction is not available in this MVP. You can use this assistant through text.

## Trust Repair Copy

If AI is uncertain:

> I am not fully confident about this because [reason]. Please confirm [specific field] and I can improve the recommendation.

If user corrects the AI:

> Thanks. I will use your correction as the reliable version.

If AI lacks data:

> I do not have enough information to answer that well yet. Add [specific missing data] and I can give a more useful recommendation.

