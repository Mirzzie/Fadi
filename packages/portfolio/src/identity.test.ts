
describe("attribution decides what may anchor identity", () => {
  const proj = (id: string, title: string, org: string, attribution?: string) =>
    item({ id, title, organization: org, kind: "project", period: "2025",
           detail: "Built and configured a self-hosted service at home.", ...(attribution ? { attribution } : {}) });

  it("THE BUG: two unrelated personal projects on the same board are not the same work", () => {
    // "Raspberry Pi" landed in `organization` because that field was a dumping ground.
    // A shared employer plus a shared year is strong evidence; a shared board is a
    // board. Untagged means personal, so it must not anchor.
    const a = proj("a", "Self-Hosted Nextcloud", "Raspberry Pi");
    const b = proj("b", "n8n Cyber-News Pipeline", "Raspberry Pi");

    expect(compareIdentity(a, b, rarityIndex([a, b])).reasons.join(" ")).not.toMatch(/same organisation|same org/i);
  });

  it("still anchors on a real employer, which is the signal worth keeping", () => {
    const a = proj("a", "Payroll migration", "Acme Ltd", "employment");
    const b = proj("b", "Payroll provider move", "Acme Ltd", "employment");
    const m = compareIdentity(a, b, rarityIndex([a, b]));

    expect(m.verdict).not.toBe("different");
  });

  it("treats an untagged record as personal rather than guessing", () => {
    const tagged = proj("a", "Thing", "Acme Ltd", "personal");
    const untagged = proj("b", "Thing", "Acme Ltd");
    const idf = rarityIndex([tagged, untagged]);

    // Neither may anchor on the org: same outcome, so the default is not a special case.
    expect(compareIdentity(tagged, untagged, idf).reasons.join(" ")).not.toMatch(/organisation/i);
  });

  it("does not anchor a third-party platform like an employer", () => {
    // Two different TryHackMe rooms are two different pieces of work.
    const a = proj("a", "Blue room", "TryHackMe", "platform");
    const b = proj("b", "Wreath network", "TryHackMe", "platform");

    expect(compareIdentity(a, b, rarityIndex([a, b])).reasons.join(" ")).not.toMatch(/organisation/i);
  });
});
