export interface SlideOverPortalDocument {
  body: HTMLElement;
}

export function resolveSlideOverPortalTarget(
  target: SlideOverPortalDocument | null,
): HTMLElement | null {
  return target?.body ?? null;
}
