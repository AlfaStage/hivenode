import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { GET as cli } from "../src/app/cli.sh/route";
import { GET as installer } from "../src/app/install.sh/route";
async function main() {
  for (const [name, route] of [["CLI", cli], ["installer", installer]] as const) {
    const script = await (await route()).text();
    const parsed = spawnSync("docker", ["exec", "-i", process.env.TEST_REDIS_CONTAINER || "hivenode-test-redis-1", "sh", "-n"], { input: script, encoding: "utf8" });
    assert.equal(parsed.status, 0, name + ": " + parsed.stderr);
    console.log("PASS: " + name + " shell syntax");
  }
}
void main();
