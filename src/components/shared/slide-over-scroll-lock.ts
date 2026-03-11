interface ScrollStyleTarget {
  overflow: string;
  overscrollBehavior: string;
}

interface ScrollLockTarget {
  body: {
    style: ScrollStyleTarget;
  };
  documentElement: {
    style: ScrollStyleTarget;
  };
}

export function lockSlideOverBackgroundScroll(target: ScrollLockTarget): () => void {
  const previousBodyOverflow = target.body.style.overflow;
  const previousBodyOverscrollBehavior = target.body.style.overscrollBehavior;
  const previousRootOverflow = target.documentElement.style.overflow;
  const previousRootOverscrollBehavior = target.documentElement.style.overscrollBehavior;

  target.body.style.overflow = "hidden";
  target.body.style.overscrollBehavior = "none";
  target.documentElement.style.overflow = "hidden";
  target.documentElement.style.overscrollBehavior = "none";

  return () => {
    target.body.style.overflow = previousBodyOverflow;
    target.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    target.documentElement.style.overflow = previousRootOverflow;
    target.documentElement.style.overscrollBehavior = previousRootOverscrollBehavior;
  };
}
