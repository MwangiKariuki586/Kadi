import { useEffect, useRef } from "preact/hooks";

/** Focus a dialog's first control, then restore the opener on close. */
export function useDialogFocus<T extends HTMLElement>(target: {
  current: T | null;
}) {
  const previous = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previous.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    target.current?.focus();
    return () => previous.current?.focus();
  }, [target]);
}
