import "dotenv/config";

import { createDatabaseClient } from "../client";
import { createJobsRepository, type SeedJobInput } from "../repositories";

const mvpJobs: SeedJobInput[] = [
  {
    source: "local_mvp_seed",
    externalId: "ai-product-engineer-remote-001",
    title: "AI Product Engineer",
    company: "Northstar Labs",
    location: "Remote - Europe",
    remoteMode: "remote",
    employmentType: "full-time",
    seniority: "mid",
    salaryText: "EUR 70k-95k",
    description:
      "Build applied AI workflows for a fast-moving product team. Strong fit for engineers with TypeScript, product sense, LLM integration, evaluation, and user-facing delivery experience.",
    url: "https://example.com/jobs/ai-product-engineer",
    rawPayload: {
      keywords: ["typescript", "next.js", "llm", "openai", "product", "evaluation"],
    },
  },
  {
    source: "local_mvp_seed",
    externalId: "full-stack-ai-engineer-002",
    title: "Full-Stack AI Engineer",
    company: "SignalWorks",
    location: "London, UK",
    remoteMode: "hybrid",
    employmentType: "full-time",
    seniority: "mid-senior",
    salaryText: "GBP 85k-115k",
    description:
      "Own full-stack AI features from prototype to production. The role values Next.js, PostgreSQL, agentic product thinking, experimentation, and strong communication with design and product partners.",
    url: "https://example.com/jobs/full-stack-ai-engineer",
    rawPayload: {
      keywords: ["next.js", "postgresql", "typescript", "ai", "product", "experimentation"],
    },
  },
  {
    source: "local_mvp_seed",
    externalId: "career-platform-product-manager-003",
    title: "Product Manager, Career Intelligence",
    company: "Pathfinder",
    location: "Remote - US/Canada",
    remoteMode: "remote",
    employmentType: "full-time",
    seniority: "senior",
    salaryText: "USD 130k-165k",
    description:
      "Lead roadmap and discovery for a career intelligence platform. Useful background includes career tech, marketplace products, AI-assisted workflows, analytics, and user research.",
    url: "https://example.com/jobs/career-intelligence-pm",
    rawPayload: {
      keywords: ["product management", "career tech", "analytics", "user research", "ai workflows"],
    },
  },
  {
    source: "local_mvp_seed",
    externalId: "frontend-product-engineer-004",
    title: "Frontend Product Engineer",
    company: "Atlas Studio",
    location: "Dublin, Ireland",
    remoteMode: "hybrid",
    employmentType: "full-time",
    seniority: "mid",
    salaryText: "EUR 65k-85k",
    description:
      "Create polished, data-rich product interfaces with React, TypeScript, design systems, and strong UX judgment. AI feature experience is a plus but not required.",
    url: "https://example.com/jobs/frontend-product-engineer",
    rawPayload: {
      keywords: ["react", "typescript", "design systems", "ux", "frontend"],
    },
  },
  {
    source: "local_mvp_seed",
    externalId: "platform-engineer-postgres-005",
    title: "Platform Engineer, PostgreSQL Systems",
    company: "Harbor Cloud",
    location: "Berlin, Germany",
    remoteMode: "on-site",
    employmentType: "full-time",
    seniority: "senior",
    salaryText: "EUR 90k-120k",
    description:
      "Develop reliable PostgreSQL-first internal platforms. Strong fit for engineers with database design, service boundaries, observability, Docker, and production operations experience.",
    url: "https://example.com/jobs/postgres-platform-engineer",
    rawPayload: {
      keywords: ["postgresql", "docker", "observability", "platform", "services"],
    },
  },
  {
    source: "local_mvp_seed",
    externalId: "junior-ai-app-developer-006",
    title: "Junior AI Application Developer",
    company: "BrightPath AI",
    location: "Remote",
    remoteMode: "remote",
    employmentType: "contract",
    seniority: "entry",
    salaryText: "USD 45-65/hour",
    description:
      "Support delivery of AI-enabled web applications using React, APIs, prompt templates, and structured QA. Designed for early-career developers building applied AI experience.",
    url: "https://example.com/jobs/junior-ai-app-developer",
    rawPayload: {
      keywords: ["react", "apis", "prompting", "qa", "ai"],
    },
  },
];

const { db, pool } = createDatabaseClient();

try {
  const jobsRepository = createJobsRepository(db);

  for (const job of mvpJobs) {
    await jobsRepository.upsertSeedJob(job);
  }

  console.log(`Seeded ${mvpJobs.length} local MVP jobs.`);
} finally {
  await pool.end();
}
