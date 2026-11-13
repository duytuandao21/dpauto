import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

async function main() {
  const root = resolve(tmpdir()),
    folder = await mkdtemp(join(root, "dpauto-phase1-"));
  const bin =
    process.env.PG_BIN ||
    (process.platform === "win32"
      ? "C:/Program Files/PostgreSQL/18/bin"
      : "/usr/lib/postgresql/18/bin");
  const exe = (name: string) =>
    join(bin, name + (process.platform === "win32" ? ".exe" : ""));
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((r) => server.close(() => r()));
  let started = false;
  try {
    const init = spawnSync(
      exe("initdb"),
      [
        "-D",
        folder,
        "-A",
        "trust",
        "-U",
        "dpauto_test",
        "--no-locale",
        "--encoding=UTF8",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    if (init.status !== 0)
      throw Error(
        "Could not initialize isolated PostgreSQL: " +
          (init.error?.message || init.stderr.slice(-400)),
      );
    // Windows server children inherit pipe handles; ignore stdio so pg_ctl can return.
    const start = spawnSync(
      exe("pg_ctl"),
      [
        "-D",
        folder,
        "-l",
        join(folder, "server.log"),
        "-o",
        `-h 127.0.0.1 -p ${port} -F`,
        "-w",
        "start",
      ],
      { stdio: "ignore", windowsHide: true, timeout: 30000 },
    );
    if (start.status !== 0)
      throw Error(
        "Could not start isolated PostgreSQL: " +
          (start.error?.message || "") +
          " " +
          (await readFile(join(folder, "server.log"), "utf8").catch(() => "")),
      );
    started = true;
    const files = process.argv.slice(2);
    const test = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--test",
        ...files.filter(arg => arg.startsWith("--")),
        ...(files.length
          ? files.filter(arg => !arg.startsWith("--"))
          : ["test/phase1.integration.test.ts", "test/planner.test.ts"]),
      ],
      {
        cwd: resolve(__dirname, ".."),
        env: {
          ...process.env,
          DP_TEST_DATABASE_URL: `postgresql://dpauto_test@127.0.0.1:${port}/postgres`,
        },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    process.exitCode = test.status ?? 1;
  } finally {
    let stopped = true;
    if (started) {
      const stop = spawnSync(
        exe("pg_ctl"),
        ["-D", folder, "-m", "fast", "-w", "stop"],
        { encoding: "utf8", windowsHide: true },
      );
      stopped = stop.status === 0;
    }
    if (
      dirname(resolve(folder)) !== root ||
      !resolve(folder).startsWith(join(root, "dpauto-phase1-"))
    )
      throw Error("Unsafe test cleanup path.");
    if (stopped) await rm(folder, { recursive: true, force: true });
    else
      console.error("Test database did not stop; files retained at " + folder);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
