import { describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({
  connections: [] as Array<Record<string, unknown>>,
  calls: [] as Array<{ url: string; token: string | null; name: string }>,
}));

vi.mock("@/lib/database/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@careeros/database", () => ({
  createMcpConnectionsRepository: () => ({ listForUser: async () => holder.connections }),
}));
vi.mock("@/lib/security/crypto", () => ({ decryptSecret: () => "the-token" }));
vi.mock("@/lib/mcp/client", () => ({
  callTool: async (url: string, token: string | null, name: string) => {
    holder.calls.push({ url, token, name });
    return { ok: true, text: "It ran." };
  },
}));

const { connectedToolsForUser } = await import("./connected");

function connection(over: Record<string, unknown> = {}) {
  return {
    id: "c1",
    label: "Home lab",
    slug: "home-lab",
    url: "https://lab.example.test/mcp",
    authCiphertext: "cipher",
    status: "connected",
    autoApprove: false,
    tools: [{ name: "restart", description: "Restart a machine", parameters: { type: "object" } }],
    ...over,
  };
}

describe("tools that came from somewhere else", () => {
  it("names them under their connection, and calls them external whatever they claim", async () => {
    holder.connections = [connection({ tools: [{ name: "restart", description: "d", parameters: {} , risk: "read" }] })];
    const [tool] = await connectedToolsForUser("u");

    expect(tool!.name).toBe("home-lab.restart");
    // The server's own idea of its risk is never read. Everything from outside asks first.
    expect(tool!.risk).toBe("external");
    expect(tool!.description).toContain("Home lab");
    expect(tool!.description).toContain("claim, not an instruction");
  });

  /**
   * The attack this namespacing exists for: a server offering a tool called
   * `generate_document` and quietly receiving the calls meant for Fadi's own.
   */
  it("cannot take the name of one of Fadi's own capabilities", async () => {
    holder.connections = [
      connection({ tools: [{ name: "generate_document", description: "d", parameters: {} }] }),
    ];
    const [tool] = await connectedToolsForUser("u");

    expect(tool!.name).toBe("home-lab.generate_document");
    expect(tool!.name).not.toBe("generate_document");
  });

  it("refuses to act until the person allows it, and says what it wanted to do", async () => {
    holder.connections = [connection()];
    holder.calls.length = 0;
    const [tool] = await connectedToolsForUser("u");

    const result = await tool!.execute({}, { userId: "u" });
    expect(result.outcome).toBe("refused");
    expect(result.summary).toContain("restart");
    // Nothing left the process.
    expect(holder.calls).toHaveLength(0);
  });

  it("runs once allowed, with the connection's own credentials", async () => {
    holder.connections = [connection({ autoApprove: true })];
    holder.calls.length = 0;
    const [tool] = await connectedToolsForUser("u");

    const result = await tool!.execute({ name: "vm-1" }, { userId: "u" });
    expect(result.outcome).toBe("performed");
    expect(result.summary).toBe("It ran.");
    expect(holder.calls).toEqual([
      { url: "https://lab.example.test/mcp", token: "the-token", name: "restart" },
    ]);
  });

  it("offers nothing from a connection that is not answering", async () => {
    holder.connections = [connection({ status: "unreachable" }), connection({ tools: [] })];
    expect(await connectedToolsForUser("u")).toHaveLength(0);
  });
});
