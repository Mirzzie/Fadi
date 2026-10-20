# Portfolio audit and ready-to-review copy

Reviewed 20 October 2026 against the live site and the CV at the beginning of the supplied conversation attachment. This is a content and link audit, not a visual or authenticated browser audit. No publishing, messaging, employment-fact changes, or analytics events were performed.

## Corrections to the previous audit

- All eight current project links on [the homepage](https://mirzzie.github.io/Mirzzie/) resolve to project pages. The previously cited Spark UUID is no longer linked there.
- The live Spark role is **IT Support Consultant, Jan 2026–Aug 2026**; F13 starts **May 2023**. These agree with the supplied CV. Do not “repair” these facts from stale search results.
- Both detail-page return links correctly point to `/Mirzzie/`. The export passes `/` to Next `Link`, which adds the configured base path. Do not manually add it again.
- The current work template exposes skill filters. The older audit's Cloud/Security/Support role selector is not present in the retrieved homepage; do not describe it as a verified current feature.

## Findings that remain

| Priority | Observed issue | Concrete repair |
| --- | --- | --- |
| P1 | The dissertation appears as both Shield-Right DevSecOps and DevSecOps Pipeline & Security Monitoring, with the same image, year and metrics. | Confirm whether these are one project; retain one canonical case study and preserve any old published URL with a redirect or alias. |
| P1 | Dissertation metrics give no visible methodology. | Attach sample size, attack corpus, baseline configuration, measurement window, overhead method and limitations before retaining the precise numbers. |
| P1 | WordPress CV describes LAMP, MySQL backup and Certbot; portfolio lists Nginx, RDS, CloudWatch and SNS. | Establish whether these are successive versions or different deployments. Label versions or use only the confirmed architecture. |
| P1 | AD and Keycloak pages mainly repeat the summary and show screenshots. | Add a sanitised repository, reproduction steps, a failure/recovery example and explicitly identified personal contribution. |
| P2 | Experience is ordered 2024, 2023, 2026. | Present most recent employment first without changing dates or titles. |
| P2 | WordPress source goes through a LinkedIn shortlink warning screen. | Replace with the verified destination `https://github.com/Mirzzie/ansible-nci` after checking repository visibility and relevance. |
| P2 | “Download CV” opens a JavaScript Cloudinary collection. | Supply a direct, versioned PDF link once the intended CV asset is identified. The collection loaded; a successful PDF download was not verified. |
| P2 | Page title is generic “Portfolio”. | Implemented locally: derive title and description from existing exported site data. |

Metrics needing supporting records, rather than an assumption of falsity:

- Dissertation: 100% SQLi/XSS blocking, under 3 ms overhead, 40% faster detection.
- Home SOC: 200+ synthetic attacks detected **and investigated**; reproducible rebuild in under 15 minutes.
- WordPress: deployment in under six minutes.
- Nextcloud: five users, 400+ GB served, 99.6% uptime across eight months.
- n8n: approximately 30 minutes saved daily.

`confirmedAt` in the export is an approval timestamp; it is not measurement evidence.

## Grounded homepage draft

Suggested positioning, not a new employment title:

**Cloud & Infrastructure Operations**

> I troubleshoot and automate Windows, Linux and cloud environments. My experience includes IT support and cloud deployment, supported by an MSc in Cybersecurity. My projects explore infrastructure automation, identity administration and security monitoring.

**Dublin, Ireland**

Keep existing email, LinkedIn and booking links. Lead with “View infrastructure projects”; keep the CV as a secondary link. Do not add work-authorisation dates or availability claims without checking the current record.

Recommended default order: AD/hybrid lab, AWS/Ansible automation, Python/Keycloak onboarding, dissertation. Keep Home SOC for security-focused applications; move n8n and Nextcloud into supporting experiments. This changes emphasis, not the underlying facts.

## Four case-study drafts and evidence requirements

### Active Directory & Hybrid IT Network Simulation

> Built a simulated corporate environment using Windows Server 2025 and a Windows 10 client on VMware. Configured the apex.local domain, organisational units and user accounts, and combined it with Linux, Raspberry Pi and IoT systems to practise administration and troubleshooting.

Add a topology diagram, sanitised OU/user configuration, domain-join verification and one documented DNS, authentication or connectivity failure. State exactly what was simulated. Do not imply production ownership or enterprise scale.

### Automated WordPress Deployment on AWS

> Automated a WordPress deployment on AWS EC2 using Ansible. Used Ansible Vault for credentials and SSH keys, configured SSL renewal with Certbot, and scheduled MySQL backups.

This wording follows the supplied CV. Reconcile the Nginx/RDS architecture before replacing live copy. Add playbooks, inventory examples, prerequisites, a backup restoration exercise and a timed run with start/finish definitions. Until measured, omit the six-minute claim.

### IT Onboarding Automation — Python and Keycloak

> Built a Python CLI that provisions users through the Keycloak Admin REST API, assigns group-based access and requires MFA enrolment at first login. Added CSV batch onboarding, fail-soft error handling and an offline mock mode.

Add a redacted sample CSV and command, successful and failed provisioning output, duplicate-user behaviour and verification that permissions and first-login MFA work. Identify which checks use mock responses versus a running Keycloak service.

### DevSecOps Pipeline & Security Monitoring

> Built a CI/CD system on AWS using Terraform and Ansible, with Prometheus, Grafana and OpenTelemetry for monitoring application performance and incidents.

Add the dissertation/report, architecture, deployment configuration and one observed incident trace. The Shield-Right runtime-security evaluation should be described separately within the same case study if confirmed to be part of it. Publish numerical outcomes only with their scope and methodology.

These are review drafts based on supplied claims, not independently verified proof of implementation.

## Delivery sequence

1. Reconcile duplicate dissertation entries and the WordPress architecture; collect metric sources.
2. Update homepage positioning and project order through the canonical portfolio owner so the next export retains them.
3. Expand the AD and Keycloak case studies first, using existing work and evidence.
4. Expand AWS and dissertation studies; add direct source and PDF links.
5. Before deployment, test homepage → each project → homepage under `/Mirzzie/`, PDF retrieval, keyboard navigation, narrow and desktop layouts, and contact paths. Test feedback only against a test collector; do not send a real message during verification.

## One factual follow-up

Can you identify the correct WordPress deployment architecture/version, confirm whether the two dissertation entries are the same work, and point to the existing measurement records and intended CV PDF? These are the facts needed to finish publication-ready copy without guessing.

## Local implementation and validation scope

Only `apps/portfolio-export/src/app/layout.tsx` metadata changed. The existing export data remains authoritative; title/description now project its existing title, headline and biography. Surface delta: no controls added, removed or moved; primary actions unchanged; no new state owner. No live content changed.

Live pages checked: [dissertation](https://mirzzie.github.io/Mirzzie/49c4d431-ac84-4d6d-a98a-20100f3ac0ed/), [Shield-Right](https://mirzzie.github.io/Mirzzie/3023599b-2e27-4dc2-9dee-b5513654aec3/), [WordPress](https://mirzzie.github.io/Mirzzie/cd233d6a-ed04-4c4a-9804-8de4a0e0775b/), [Keycloak](https://mirzzie.github.io/Mirzzie/4f52a860-cfe6-46e4-aa53-76dcb3a03f92/), [AD](https://mirzzie.github.io/Mirzzie/73a0dcca-a6ef-47d9-b864-c12570e61b07/), [SOC](https://mirzzie.github.io/Mirzzie/1e8f08a4-1cbd-4836-927b-050e392ea5e4/), [n8n](https://mirzzie.github.io/Mirzzie/9fcd0540-f6ad-4a86-b8c7-70161fd9c2d0/), [Nextcloud](https://mirzzie.github.io/Mirzzie/32487950-53b1-4069-a3ca-e1c07279f8c3/).
