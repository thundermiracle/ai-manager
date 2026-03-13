import { buildToastNotification } from "../src/components/shared/toast-feedback.ts";

test("toast notification stays null when no feedback exists", () => {
  expect(buildToastNotification(null)).toBeNull();
});

test("toast notification maps success feedback directly", () => {
  expect(buildToastNotification({ kind: "success", message: "Saved." })).toEqual({
    tone: "success",
    message: "Saved.",
  });
});

test("toast notification prefixes diagnostic codes for error feedback", () => {
  expect(
    buildToastNotification({
      kind: "error",
      message: "Config write failed.",
      diagnostic: { code: "CONFIG_WRITE_FAILED" },
    }),
  ).toEqual({
    tone: "error",
    message: "CODE: CONFIG_WRITE_FAILED | Config write failed.",
  });
});
