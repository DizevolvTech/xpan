import assert from "node:assert/strict";
import test from "node:test";

import {
  isMasterClientAdminEmailConflictMessage,
  MASTER_CLIENT_ADMIN_EMAIL_CONFLICT_MESSAGE,
} from "@/lib/master-clients";

test("master client email conflict helper recognizes the friendly conflict message", () => {
  assert.equal(
    isMasterClientAdminEmailConflictMessage(MASTER_CLIENT_ADMIN_EMAIL_CONFLICT_MESSAGE),
    true,
  );
});

test("master client email conflict helper recognizes database unique email errors", () => {
  assert.equal(
    isMasterClientAdminEmailConflictMessage(
      'Failed to create user: duplicate key value violates unique constraint "profiles_email_key"',
    ),
    true,
  );
});

test("master client email conflict helper ignores unrelated errors", () => {
  assert.equal(
    isMasterClientAdminEmailConflictMessage("Failed to create tenant operational settings"),
    false,
  );
});
