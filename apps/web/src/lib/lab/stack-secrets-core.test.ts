import { describe, expect, it } from "vitest";

import { WAZUH_FILES } from "./stacks/wazuh-files";
import {
  WAZUH_DEMO_SECRETS,
  applyWazuhSecrets,
  newWazuhSecrets,
  parseHashes,
} from "./stack-secrets-core";

const HASH_A = "$2y$12$UQMJS.aoQIOYuW4ztVFpgeGRjs3P2DySYVG96aVF3Osv5yTadcHl.";
const HASH_B = "$2y$12$FZ88e.dRV2z34dyBT/3douL5KPt4EPiqsboI57LeNG54zTLwEk43q";

let counter = 0;
const random = () => Buffer.from(Array.from({ length: 24 }, () => (counter++ * 37) % 256));

describe("per-project Wazuh credentials (Codex scan P1)", () => {
  it("makes passwords Wazuh's API accepts and Compose and YAML need not quote", () => {
    const secrets = newWazuhSecrets(random);
    for (const value of [secrets.admin, secrets.kibanaserver, secrets.api]) {
      expect(value).toMatch(/^[A-Za-z0-9._-]{28}$/);
      expect(value).toMatch(/[A-Z]/);
      expect(value).toMatch(/[a-z]/);
      expect(value).toMatch(/[0-9]/);
      expect(value).toMatch(/[._-]/);
    }
    expect(secrets.cluster).toMatch(/^[0-9a-f]{32}$/);
    expect(new Set([secrets.admin, secrets.kibanaserver, secrets.api]).size).toBe(3);
  });

  it("reads the hashes Wazuh's tool printed, ignoring its warnings", () => {
    expect(parseHashes(`WARNING: something\n${HASH_A}\n\n${HASH_B}\n`)).toEqual([HASH_A, HASH_B]);
  });

  it("leaves no demo credential in a new stack's files", () => {
    const secrets = { ...newWazuhSecrets(random), adminHash: HASH_A, kibanaserverHash: HASH_B };
    const files = applyWazuhSecrets({ ...WAZUH_FILES }, secrets);
    const all = Object.values(files).join("\n");
    expect(all).not.toContain("SecretPassword");
    expect(all).not.toContain("MyS3cr37P450r");
    expect(all).not.toContain("DASHBOARD_PASSWORD=kibanaserver");
    expect(all).not.toContain(WAZUH_DEMO_SECRETS.cluster);
    const users = files["config/wazuh_indexer/internal_users.yml"]!;
    expect(users).toContain(HASH_A);
    expect(users).toContain(HASH_B);
    // The other demo users, each with a published password, are gone.
    for (const demo of ["kibanaro:", "logstash:", "readall:", "snapshotrestore:"]) {
      expect(users).not.toContain(demo);
    }
    expect(files["docker-compose.yml"]).toContain(`INDEXER_PASSWORD=${secrets.admin}`);
    expect(files["config/wazuh_dashboard/wazuh.yml"]).toContain(`"${secrets.api}"`);
  });

  it("never rewrites a stack that was started with the demo credentials", () => {
    expect(applyWazuhSecrets({ ...WAZUH_FILES }, WAZUH_DEMO_SECRETS)).toEqual(WAZUH_FILES);
  });

  it("fails loudly if an upgraded Wazuh moved a credential, rather than shipping the demo one", () => {
    const moved = {
      ...WAZUH_FILES,
      "docker-compose.yml": WAZUH_FILES["docker-compose.yml"]!.replace(
        "INDEXER_PASSWORD=SecretPassword",
        "INDEXER_PASSWORD_FILE=/run/secrets/x"
      ),
    };
    const secrets = { ...newWazuhSecrets(random), adminHash: HASH_A, kibanaserverHash: HASH_B };
    expect(() => applyWazuhSecrets(moved, secrets)).toThrow(/INDEXER_PASSWORD=SecretPassword/);
    expect(() => applyWazuhSecrets({ ...WAZUH_FILES }, newWazuhSecrets(random))).toThrow(/hashes/);
  });
});
