import assert from "node:assert/strict";
import test from "node:test";

import { resolveSlideOverPortalTarget } from "../src/components/shared/slide-over-portal-target.ts";
import { lockSlideOverBackgroundScroll } from "../src/components/shared/slide-over-scroll-lock.ts";

test("slide-over scroll lock hides background scrolling until restored", () => {
  const target = {
    body: {
      style: {
        overflow: "auto",
        overscrollBehavior: "contain",
      },
    },
    documentElement: {
      style: {
        overflow: "clip",
        overscrollBehavior: "auto",
      },
    },
  };

  const restore = lockSlideOverBackgroundScroll(target);

  assert.deepEqual(target, {
    body: {
      style: {
        overflow: "hidden",
        overscrollBehavior: "none",
      },
    },
    documentElement: {
      style: {
        overflow: "hidden",
        overscrollBehavior: "none",
      },
    },
  });

  restore();

  assert.deepEqual(target, {
    body: {
      style: {
        overflow: "auto",
        overscrollBehavior: "contain",
      },
    },
    documentElement: {
      style: {
        overflow: "clip",
        overscrollBehavior: "auto",
      },
    },
  });
});

test("slide-over portal target resolves to document body", () => {
  const body = {} as HTMLElement;

  assert.equal(resolveSlideOverPortalTarget({ body }), body);
  assert.equal(resolveSlideOverPortalTarget(null), null);
});
