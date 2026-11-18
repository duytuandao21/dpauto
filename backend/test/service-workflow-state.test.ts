import { test } from "node:test";
import assert from "node:assert/strict";
import { checkServiceTransition, serviceStages } from "../src/service-workflow";

test("V2 permits only consecutive stages and never completes paused work", () => {
  for (let i = 0; i < serviceStages.length - 1; i++)
    assert.doesNotThrow(() =>
      checkServiceTransition(serviceStages[i], serviceStages[i + 1]),
    );
  for (const from of [...serviceStages, "ABORTED", "READY"])
    for (const to of serviceStages)
      if (
        serviceStages.indexOf(from as (typeof serviceStages)[number]) + 1 !==
          serviceStages.indexOf(to) ||
        !serviceStages.includes(from as (typeof serviceStages)[number])
      )
        assert.throws(() => checkServiceTransition(from, to));
  assert.throws(() => checkServiceTransition("IN_PROGRESS", "HANDOVER", true));
});
