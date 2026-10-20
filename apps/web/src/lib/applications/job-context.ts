type JobSource = {
  title: string;
  company: string;
  description?: string | null;
  url?: string | null;
};

type ApplicationSource = {
  title: string;
  company: string;
  jobDescription?: string | null;
  url?: string | null;
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Resolve the context for one pursued role.
 *
 * The discovered job is the fallback. Once an application exists, its saved fields
 * win because they represent the exact posting and wording the person is acting on.
 */
export function resolveApplicationJobContext(
  job: JobSource,
  application?: ApplicationSource | null
) {
  return {
    title: nonEmpty(application?.title) ?? job.title,
    company: nonEmpty(application?.company) ?? job.company,
    description: nonEmpty(application?.jobDescription) ?? nonEmpty(job.description),
    url: nonEmpty(application?.url) ?? nonEmpty(job.url),
  };
}
