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

  expect(target).toEqual({
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

  expect(target).toEqual({
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

  expect(resolveSlideOverPortalTarget({ body })).toBe(body);
  expect(resolveSlideOverPortalTarget(null)).toBeNull();
});
