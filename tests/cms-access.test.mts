import test from "node:test";
import assert from "node:assert/strict";
import { canOpenCms, canProvisionCmsAccounts } from "../src/lib/api/cms.ts";
import type { AuthSession } from "../src/lib/api/types.ts";

test("CMS workspace separates content access from existing account-provisioning authority", () => {
  const session = (roles: string[], permissions: string[]) =>
    ({ roles, permissions }) as AuthSession;
  const editor = session(["CMS_ADMIN"], ["cms.read", "cms.write"]);
  assert.equal(canOpenCms(editor), true);
  assert.equal(canProvisionCmsAccounts(editor), false);
  const owner = session(["MANAGER"], ["roles.manage", "staff.manage"]);
  assert.equal(canOpenCms(owner), true);
  assert.equal(canProvisionCmsAccounts(owner), true);
  assert.equal(owner.permissions.includes("cms.read"), false);
  assert.equal(canOpenCms(session(["MANAGER"], ["staff.manage"])), false);
  assert.equal(
    canOpenCms(session(["ADVISOR"], ["roles.manage", "staff.manage"])),
    false,
  );
  assert.equal(canOpenCms(null), false);
});
