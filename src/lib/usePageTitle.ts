import { useEffect } from "react";

/** Names the browser tab after the page, which is also what a screen reader announces after navigating. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · AluthJob` : "AluthJob";
  }, [title]);
}
