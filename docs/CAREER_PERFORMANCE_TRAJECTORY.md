# Career Performance Trajectory Algorithm

## Purpose

The Career Performance Trajectory (CPT) is a continuous algorithm that runs alongside Fadi, measuring the user's actual competitive position in the job market and predicting their path to the next career milestone.

This is not a gamification layer. It is a diagnostic and prediction engine — the equivalent of a fitness tracker for job searching, built on real market benchmarks.

---

## Why This Exists

The job market is opaque. Most job seekers operate without any signal of how they are actually performing relative to others. They do not know whether their response rate is above or below average, whether their application quality is improving, or whether their current strategy will get them to an offer in 3 weeks or 6 months.

This uncertainty is a major driver of anxiety, burnout, and poor decision-making. The user either gives up too early (because they cannot see progress) or continues a failing strategy too long (because they have no objective feedback).

The CPT gives Fadi the data it needs to give the user honest, specific, actionable intelligence about their search.

---

## Data Inputs

### Active Search Signals (tracked per user)

| Signal | Description | Frequency |
|---|---|---|
| Application sent | Job applied to (role, company, source, method) | Per event |
| Application outcome | Response received / no response / rejection / interview | Per event |
| Interview outcome | No further progress / next round / offer | Per event |
| Response time | Days from application to first contact | Per event |
| Platform | Where the application was sent (LinkedIn, company site, referral, etc.) | Per event |
| Application quality score | AI-assessed match between application and JD | Per application |

### Profile Signals (tracked over time)

| Signal | Description |
|---|---|
| Profile completeness | % of career evidence fields populated |
| Skill coverage | % of target role required skills documented in profile |
| Proof of work density | Number and quality of projects, contributions, publications |
| LinkedIn completeness | Profile sections, connections in target field |
| Career readiness score | Composite from Fadi's career analysis |
| Resume quality score | From Fadi's career analysis |

### Market Benchmarks (sourced from research data, updated periodically)

| Benchmark | Value | Source |
|---|---|---|
| Average applications per hire | ~32 | Career.IO 2025 |
| Average response rate | 2–3% | Industry average 2025 |
| Average recruiter scan time | 11.2 seconds | Interviewpal 2025 |
| LinkedIn response rate | 3–13% | Ghosting Index 2025 |
| Referral hire rate | 6.6% | Multiple sources |
| Cold online application hire rate | 0.4% | Business Insider 2026 |
| Typical time to offer | 68.5 days | Industry average 2025 |
| Skills-based hiring adoption | 73% | SHRM 2025 |

---

## Computed Scores

### 1. Application Quality Score (AQS)

Computed per application before and after submission.

**Inputs**:
- Keyword overlap between resume/application and JD
- Formatting parse score (single-column, ATS-safe elements)
- Specificity score (concrete metrics and outcomes vs. generic statements)
- Personalisation score (company-specific references vs. generic)
- Evidence match (which listed skills have documented proof of work)
- Role fit score (seniority alignment, location fit, experience relevance)

**Output**: 0–100 integer. 70+ is viable. 85+ is strong.

**Use**: Fadi uses AQS to tell the user whether an application is ready to send or needs improvement — before it is sent. Low AQS triggers specific improvement suggestions.

---

### 2. Response Rate Index (RRI)

**Formula**: `(responses received / applications sent) × 100`

**Benchmarks**:
- Below 1%: Well below market average — likely a targeting or quality problem
- 1–3%: At market average — search is functional but not differentiated
- 3–8%: Above average — strategy is working
- 8–15%: Strong — candidate is well-targeted and differentiated
- 15%+: Exceptional — likely strong network activation or highly in-demand profile

**Use**: Fadi uses RRI to identify whether the user's strategy is working and surface the specific factors most likely to improve it.

---

### 3. Interview Conversion Rate (ICR)

**Formula**: `(interviews / responses) × 100`

**Benchmarks**:
- Below 20%: Responses are not converting — screening call or initial interview stage is the bottleneck
- 20–40%: Market average
- 40–60%: Strong
- 60%+: Exceptional — profile and interview preparation are working

---

### 4. Skill Gap Velocity (SGV)

Tracks how fast the gap between the user's current skills and their target role's required skills is closing.

**Formula**: `(skills added to profile in last 30 days) / (total skill gap at start of period)`

**Use**: Positive SGV means the user is making real progress toward role readiness. Stalled SGV triggers learning recommendations.

---

### 5. Market Demand Alignment (MDA)

Compares the user's target role to actual market hiring signals:
- Is this role growing or shrinking in hiring volume?
- Is the user's target geography a strong market for this role?
- Is the seniority level the user is targeting realistic for their profile?
- What is the competition level (applications per posting) for this role type?

**Output**: Alignment rating (strong / moderate / misaligned) with specific signals.

**Use**: Fadi uses MDA to validate or challenge the user's career direction with real data. If a field is declining or oversaturated, Fadi says so — honestly, specifically, and with a recommended adjustment.

---

### 6. Network Activation Score (NAS)

Tracks whether the user is building a referral network. A referral is a genuinely
*independent* draw: under algorithmic monoculture (FAccT 2026; Kleinberg & Raghavan,
PNAS 2021) applications screened by the same vendor are correlated, so the n+1th cold
application is worth far less than the first, while a referral re-rolls through a
different filter entirely.

> Previously stated here as *"the data shows... 1 referral = 40 cold applications."*
> That figure is on the Retired Claims table in `PLATFORM_IDEOLOGY.md` — directionally
> right, numerically unsourceable. See `ASSUMPTION_LEDGER.md` R1.

**Inputs**:
- Connections made with people in target companies or roles (last 30 days)
- Events attended or registered for in target field
- LinkedIn connection growth rate in target sector
- Referral applications submitted vs. total applications

**Output**: 0–100, compared to a benchmark of what effective networkers in the same field look like.

---

### 7. Career Performance Trajectory (CPT) — Master Score

A composite of all six scores, weighted by their relative impact on job search outcomes based on market research.

**Weights** (approximate, tuned over time with outcome data):
- Application Quality Score: 25%
- Response Rate Index: 20%
- Interview Conversion Rate: 15%
- Market Demand Alignment: 20%
- Network Activation Score: 15%
- Skill Gap Velocity: 5%

**Output**:
- A 0–100 score (current snapshot)
- A 30-day trajectory line (rising, flat, falling)
- A verbal assessment from Fadi ("Your competitive position is improving. The main bottleneck is your application response rate, which is below market average for your target role. Here is why and what to change.")

---

## Predictions

### Time-to-First-Interview Estimate

**Model**: Based on current RRI, AQS, NAS, and historical market data for the user's target role and geography.

**Example output**: "At your current application rate and response rate, Fadi estimates your first interview within 4–6 weeks. Improving your AQS from 68 to 80+ would shorten this to 2–3 weeks."

### Time-to-Offer Estimate

**Model**: Based on ICR, time-to-first-interview estimate, and typical offer/interview ratios for the target role.

**Example output**: "Based on your current trajectory, a realistic timeline to an offer is 8–12 weeks. The largest risk factor is your interview conversion rate — you are converting responses to interviews at 18%, below the 35% average for this role type."

### Bottleneck Identification

The algorithm identifies the single biggest factor limiting progress at any given time. One of:

1. **Targeting** — applying to roles that are a poor fit for the current profile
2. **Application quality** — applications are not passing the initial scan
3. **Formatting/ATS** — resume is being filtered before human review
4. **Network gap** — zero referral activation in a market where referrals dominate
5. **Skills gap** — profile is not meeting the minimum for the target role
6. **Market misalignment** — target field or role is declining, oversaturated, or geographically mismatched
7. **Volume** — not enough applications for the current conversion rate to generate results in a reasonable timeframe

Fadi surfaces the bottleneck and addresses it with a specific, actionable recommendation — not generic advice.

---

## What Fadi Does With This Data

Fadi uses the CPT algorithm to power:

1. **Daily briefing**: "Here is where your search stands. Your RRI improved this week. Your most urgent action is..."
2. **Application gating**: "This application scores 62/100 AQS. Before you send it, here are three specific improvements that will raise it to 80+."
3. **Strategic challenges**: "You have applied to 28 roles in the past 3 weeks with a 1.2% response rate. The data suggests a targeting problem. Here are three roles where your profile is a significantly stronger match."
4. **Market honesty**: "The mid-level product role you are targeting has 340 average applications. Your current profile places you in the bottom 40% of applicants for this specific role. Here is the fastest path to the top 20%."
5. **Motivation grounded in reality**: "Your career readiness score has improved 12 points in 3 weeks. You are measurably closer to this role than you were last month. The algorithm shows your first interview is likely within the next 2 weeks at your current pace."

---

## Implementation Notes

### Phase 1 (current)

Compute AQS per application using the Fadi career report data and JD text. Display to the user before they finalize any application.

### Phase 2

Track application outcomes in the database. Begin computing RRI and ICR. Surface to user in dashboard.

### Phase 3

Integrate market benchmark data from job source APIs. Compute MDA against live market signals. Enable time-to-offer prediction.

### Phase 4

Full CPT dashboard with trajectory visualisation. Bottleneck identification surfaced proactively by Fadi. Real-time network activation tracking.

---

## What This Is Not

- Not a vanity metric. The CPT tells the truth, even when it is uncomfortable.
- Not a gamification system. There are no streaks, badges, or leaderboards.
- Not a forecast that pretends certainty. Estimates are ranges, not guarantees, and Fadi communicates uncertainty explicitly.
- Not a replacement for the user's judgment. The algorithm informs Fadi's recommendations. The user always has the final say.

---

*Research basis: Interview Guys 2025, Career.IO 2025, SHRM 2025, Interviewpal 2025, Ghosting Index 2025, Business Insider/Novorésumé 2026.*
