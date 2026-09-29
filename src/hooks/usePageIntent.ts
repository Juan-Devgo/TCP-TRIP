import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";

import { useIsTabActive, useTabPath } from "@/context/TabsProvider";

/**
 * A one-shot instruction passed to a page through the query string
 * (`/teacher/courses/assign?exercise=<id>`). The tab system keys on the pathname only,
 * so the page reads the parameter while it is the tab on screen, acts on it,
 * then `consume()`s it so a later visit does not repeat the action.
 */
export function usePageIntent(param: string): { value: string | null; consume: () => void } {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = useIsTabActive();
  const tabPath = useTabPath();

  // An inactive tab still sees the router's location — which belongs to the
  // tab on screen. Only the tab actually showing this pathname may read it.
  const mine = isActive && tabPath === location.pathname;
  const value = mine ? new URLSearchParams(location.search).get(param) : null;

  const consume = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has(param)) return;
    params.delete(param);
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true });
  }, [location.pathname, location.search, navigate, param]);

  return { value, consume };
}
