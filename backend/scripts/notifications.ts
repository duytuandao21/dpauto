import { loadConfig } from "../src/config";
import { Database } from "../src/database";
import { Notifications } from "../src/notifications";

async function main() {
  const config = loadConfig(),
    db = new Database(config.databaseUrl);
  try {
    console.log(JSON.stringify(await new Notifications(db, config).work()));
  } finally {
    await db.close();
  }
}
main().catch(() => {
  console.error("Notification batch failed; check database access.");
  process.exitCode = 1;
});
