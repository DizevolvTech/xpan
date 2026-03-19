import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSupabaseResult,
  resolveOptionalSupabaseResult,
  type SupabaseError,
} from "@/lib/supabase-data/result-helpers";

test("resolveOptionalSupabaseResult returns null when maybeSingle finds no row", () => {
  const result = resolveOptionalSupabaseResult<{ id: string }>(
    {
      data: null,
      error: null,
    },
    "Failed to resolve optional row",
  );

  assert.equal(result, null);
});

test("resolveOptionalSupabaseResult throws when Supabase returns an error", () => {
  const error: SupabaseError = {
    message: "boom",
  };

  assert.throws(
    () =>
      resolveOptionalSupabaseResult<{ id: string }>(
        {
          data: null,
          error,
        },
        "Failed to resolve optional row",
      ),
    /Failed to resolve optional row: boom/,
  );
});

test("assertSupabaseResult still rejects null data for required queries", () => {
  assert.throws(
    () =>
      assertSupabaseResult<{ id: string }>(
        {
          data: null,
          error: null,
        },
        "Required row",
      ),
    /Required row: no data returned/,
  );
});
