import type { Api } from "../src/api";
import { sql } from "../src/database";

export function useLegacyVisitFixtures(api: Api) {
  const create = api.visits.create.bind(api.visits);
  // Existing phase tests exercise V1 gates; V2 reception has its own integration cases.
  api.visits.create = async (c, ctx, input, bookingId) => {
    const receipt = await create(c, ctx, input, bookingId);
    await c.execute(
      sql`UPDATE service_visits SET workflow_version=1,stage='RECEIVED' WHERE id=${receipt.visitId} AND workflow_version=2 AND stage='QUOTING'`,
    );
    return { ...receipt, stage: "RECEIVED" };
  };
}
