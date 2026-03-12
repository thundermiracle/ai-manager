import assert from "node:assert/strict";
import test from "node:test";

import { buildToastNotification } from "../src/components/shared/toast-feedback.ts";

test("toast notification stays null when no feedback exists", () => {
  assert.equal(buildToastNotification(null), null);
});

test("toast notification maps success feedback directly", () => {
  assert.deepEqual(buildToastNotification({ kind: "success", message: "Saved." }), {
    tone: "success",
    message: "Saved.",
  });
});

test("toast notification prefixes diagnostic codes for error feedback", () => {
  assert.deepEqual(
    buildToastNotification({
      kind: "error",
      message: "Config write failed.",
      diagnostic: { code: "CONFIG_WRITE_FAILED" },
    }),
    {
      tone: "error",
      message: "CODE: CONFIG_WRITE_FAILED | Config write failed.",
    },
  );
});
