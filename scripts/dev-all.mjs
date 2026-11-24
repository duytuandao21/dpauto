// Starts backend (4002) and frontend (4001) together; Ctrl+C stops both.
import { spawn } from "node:child_process";

const run = (args) =>
  spawn("npm", args, { stdio: "inherit", shell: true });
const children = [run(["run", "api:dev"]), run(["run", "dev"])];
const stop = () => children.forEach((c) => c.exitCode === null && c.kill());
children.forEach((c) =>
  c.on("exit", (code) => {
    stop();
    process.exitCode = code ?? 0;
  }),
);
process.on("SIGINT", stop);
