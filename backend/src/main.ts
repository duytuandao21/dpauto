import { createApp } from "./app";
import { loadConfig } from "./config";

async function main() {
  const config = loadConfig(),
    { app } = await createApp(config);
  await app.listen(config.port, config.host);
  console.log(`DPAuto API listening on ${config.host}:${config.port}`);
}
main().catch((error) => {
  console.error(
    error instanceof Error && error.message.startsWith("Invalid environment:")
      ? error.message
      : "API could not start. Check configuration and database access.",
  );
  process.exitCode = 1;
});
