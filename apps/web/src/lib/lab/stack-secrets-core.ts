/**
 * The pure half of per-project Wazuh credentials: what they are, how they are made, and how the
 * upstream files are rewritten with them. Tested without Docker.
 */

export type WazuhSecrets = {
  /** The dashboard and indexer `admin` — what the person signs in with. */
  admin: string;
  /** The dashboard's own account with the indexer. */
  kibanaserver: string;
  /** The Wazuh API account the dashboard uses (`wazuh-wui`). */
  api: string;
  /** The manager's cluster key. */
  cluster: string;
  adminHash?: string;
  kibanaserverHash?: string;
  /** Started with wazuh-docker's published demo credentials, before this existed. */
  legacy?: boolean;
};

/** wazuh-docker's published defaults — what a stack started before 16 Oct 2026 has. */
export const WAZUH_DEMO_SECRETS: WazuhSecrets = {
  admin: "SecretPassword",
  kibanaserver: "kibanaserver",
  api: "MyS3cr37P450r.*-",
  cluster: "aa093264ef885029653eea20dfcf51ae",
  legacy: true,
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-";

/**
 * One password: 24 random characters from a set that needs no quoting in YAML or Compose, behind
 * a fixed "Fd9." so Wazuh's API policy (upper, lower, digit, symbol) always holds.
 */
function password(bytes: Buffer): string {
  return "Fd9." + [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("").slice(0, 24);
}

export function newWazuhSecrets(random: () => Buffer): WazuhSecrets {
  return {
    admin: password(random()),
    kibanaserver: password(random()),
    api: password(random()),
    cluster: random().toString("hex").slice(0, 32).padEnd(32, "0"),
  };
}

const BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/** The hashes Wazuh's hash tool printed, one per line, in the order the passwords were given. */
export function parseHashes(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => BCRYPT.test(line));
}

const DEMO_ADMIN_HASH = "$2y$12$K/SpwjtB.wOHJ/Nc6GVRDuc1h0rM1DfvziFRNPtk27P.c4yDr9njO";
const DEMO_KIBANASERVER_HASH = "$2a$12$4AcgAt3xwOWadA5s5blL6ev39OXDNhmOesEoo33eZtrq2N0YrU3H.";

/**
 * Rewrite the upstream files for one stack. A legacy stack's files stay exactly upstream's. A
 * new one gets its own passwords everywhere they appear, its own cluster key, and none of the
 * indexer's other demo users (kibanaro, logstash, readall, snapshotrestore — all with published
 * passwords). Throws if an expected upstream string is missing, so a Wazuh upgrade that moves
 * them fails loudly instead of shipping demo credentials.
 */
export function applyWazuhSecrets(
  files: Record<string, string>,
  secrets: WazuhSecrets
): Record<string, string> {
  if (secrets.legacy) return files;
  if (!secrets.adminHash || !secrets.kibanaserverHash) {
    throw new Error("New Wazuh credentials need their hashes.");
  }
  const swap = (path: string, from: string, to: string, times: number) => {
    const content = files[path];
    if (content === undefined || content.split(from).length - 1 !== times) {
      throw new Error(`Wazuh's ${path} no longer has the expected "${from}" (${times}×).`);
    }
    files[path] = content.replaceAll(from, to);
  };
  files = { ...files };
  const compose = "docker-compose.yml";
  swap(compose, "INDEXER_PASSWORD=SecretPassword", `INDEXER_PASSWORD=${secrets.admin}`, 2);
  swap(compose, "DASHBOARD_PASSWORD=kibanaserver", `DASHBOARD_PASSWORD=${secrets.kibanaserver}`, 1);
  swap(compose, "API_PASSWORD=MyS3cr37P450r.*-", `API_PASSWORD=${secrets.api}`, 2);
  swap("config/wazuh_dashboard/wazuh.yml", '"MyS3cr37P450r.*-"', `"${secrets.api}"`, 1);
  swap("config/wazuh_cluster/wazuh_manager.conf", WAZUH_DEMO_SECRETS.cluster, secrets.cluster, 1);

  const users = "config/wazuh_indexer/internal_users.yml";
  swap(users, DEMO_ADMIN_HASH, secrets.adminHash, 1);
  swap(users, DEMO_KIBANASERVER_HASH, secrets.kibanaserverHash, 1);
  const content = files[users]!;
  const cut = content.indexOf("\nkibanaro:");
  if (cut < 0) throw new Error("Wazuh's internal_users.yml no longer lists its demo users.");
  files[users] = content.slice(0, cut + 1);
  return files;
}
