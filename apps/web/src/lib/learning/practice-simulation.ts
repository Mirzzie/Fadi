type InstalledSimulation = {
  pack: { id: string; domain: { id: string }; trust: string };
  activity: { id: string; title: string; outcome: string };
};

/** Pick the existing optional example, not a recommendation or a grading/release decision. */
export function practiceSimulation(
  direction: { role?: string | null; domain?: string | null },
  installed: readonly InstalledSimulation[]
): { title: string; description: string; href: string; experimental: boolean } | null {
  const role = direction.role ?? "";
  const text = `${direction.domain ?? ""} ${role}`;
  // An industry is not a job function: recruiting or selling for IT/cloud is business work.
  const businessRole =
    /\b(recruit(?:er|ing|ment)|sales|account executive|account manager|customer success|marketing|human resources|hr)\b/i.test(
      role
    );
  const technical =
    !businessRole &&
    /\b(cyber(?:security)?|information security|security operations|security analyst|security engineer|soc|iam|identity|cloud (?:operations|engineer(?:ing)?|architect(?:ure)?|support|admin(?:istrator|istration)?)|infrastructure|devops|sre|it (?:support|operations|admin(?:istrator|istration)?|technician|engineer|specialist)|helpdesk|service desk|systems? (?:engineer|admin(?:istrator)?))\b/i.test(
      text
    );
  const wanted = technical ? "security-operations" : "customer-success";
  const selected = installed.find((item) => item.pack.domain.id === wanted);
  if (!selected) return null;
  return {
    title: selected.activity.title,
    description: selected.activity.outcome,
    href: `/dashboard/learning/practice/${encodeURIComponent(selected.pack.id)}/${encodeURIComponent(selected.activity.id)}`,
    experimental: selected.pack.trust === "experimental",
  };
}
