import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useTabId } from "@/context/TabsProvider";

/**
 * A keyboard shortcut a tool binds to one of its actions. Modifiers are listed
 * explicitly so the same declaration drives both the matching and the `<Kbd>`
 * labels the toolbar shows.
 */
export type ActionShortcut = {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  /** A `KeyboardEvent.key` value, matched case-insensitively (`"c"`, `"Enter"`). */
  key: string;
};

/**
 * One action a tool offers from the top-right corner of the content area.
 * Tools declare these from their own small `<ToolName>Actions` component; the
 * layout decides how to show them (a button for one, a menu for several).
 */
export type ToolAction = {
  /** Stable within the tool — used as the React key. */
  id: string;
  /** Already translated: the tool owns its copy. */
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  /** Optional hotkey; only fires while the tool's tab is the active one. */
  shortcut?: ActionShortcut;
  onSelect: () => void;
};

type ToolActionsStore = {
  actionsByTab: Record<string, ToolAction[]>;
  publish: (tabId: string, actions: ToolAction[] | null) => void;
};

const ToolActionsContext = createContext<ToolActionsStore | null>(null);

/**
 * Actions are stored per tab because inactive tabs stay mounted: without the
 * tab key, a hidden tool would overwrite the actions of the visible one.
 */
export function ToolActionsProvider({ children }: { children: React.ReactNode }) {
  const [actionsByTab, setActionsByTab] = useState<Record<string, ToolAction[]>>({});

  const publish = useCallback((tabId: string, actions: ToolAction[] | null) => {
    setActionsByTab((current) => {
      if (actions === null) {
        if (!(tabId in current)) return current;
        const next = { ...current };
        delete next[tabId];
        return next;
      }
      return { ...current, [tabId]: actions };
    });
  }, []);

  const value = useMemo(() => ({ actionsByTab, publish }), [actionsByTab, publish]);

  return <ToolActionsContext value={value}>{children}</ToolActionsContext>;
}

function useStore(): ToolActionsStore {
  const store = useContext(ToolActionsContext);
  if (!store) {
    throw new Error("Tool actions must be used inside <ToolActionsProvider>");
  }
  return store;
}

/** What the toolbar renders for the tab currently on screen. */
export function useTabActions(tabId: string | null): ToolAction[] {
  const { actionsByTab } = useStore();
  return (tabId && actionsByTab[tabId]) || [];
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Keys whose `KeyboardEvent.key` name is too long to sit in a badge. */
const KEY_LABELS: Record<string, string> = {
  Escape: "ESC",
  " ": "Space",
};

/** The pieces a `<KbdGroup>` renders, in reading order. */
export function shortcutKeys(shortcut: ActionShortcut): string[] {
  const keys: string[] = [];
  if (shortcut.ctrl) keys.push("Ctrl");
  if (shortcut.alt) keys.push(isMac ? "⌥" : "Alt");
  if (shortcut.shift) keys.push("Shift");
  if (shortcut.meta) keys.push(isMac ? "⌘" : "Meta");
  keys.push(
    KEY_LABELS[shortcut.key] ??
      (shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key),
  );
  return keys;
}

/** Flat text for `title`/`aria-label`, where markup is not an option. */
export function shortcutLabel(shortcut: ActionShortcut): string {
  return shortcutKeys(shortcut).join(" + ");
}

function matchesShortcut(event: KeyboardEvent, shortcut: ActionShortcut): boolean {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    event.ctrlKey === Boolean(shortcut.ctrl) &&
    event.altKey === Boolean(shortcut.alt) &&
    event.shiftKey === Boolean(shortcut.shift) &&
    event.metaKey === Boolean(shortcut.meta)
  );
}

// Parked with the guard above; kept so re-enabling is a one-line change.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Runs the shortcuts of the tab on screen. Bound once by the toolbar rather
 * than by each tool, so inactive-but-mounted tools can never steal a key.
 */
export function useToolActionShortcuts(tabId: string | null): void {
  const actions = useTabActions(tabId);

  const latest = useRef(actions);
  latest.current = actions;

  const bound = actions.some((action) => action.shortcut);

  useEffect(() => {
    if (!tabId || !bound) return;

    function onKeyDown(event: KeyboardEvent) {
      for (const action of latest.current) {
        const { shortcut } = action;
        if (!shortcut || action.disabled) continue;
        if (!matchesShortcut(event, shortcut)) continue;
        // Disabled while testing: a shortcut that silently stops working once
        // the caret is in a field reads as broken. Re-enable if a bare key ever
        // needs to coexist with typing.
        // const bare = !shortcut.ctrl && !shortcut.alt && !shortcut.meta;
        // if (bare && isTypingTarget(event.target)) continue;

        event.preventDefault();
        action.onSelect();
        return;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [tabId, bound]);
}

/**
 * Publishes a tool's actions to the toolbar. Call it from a component that
 * renders nothing (e.g. `NumberBaseConverterActions`); outside a tab it is a
 * no-op, so a tool can still be mounted on its own.
 */
export function useToolActions(actions: ToolAction[]): void {
  const tabId = useTabId();
  const { publish } = useStore();

  const latest = useRef(actions);
  latest.current = actions;

  // Republish only when the visible shape changes. Handlers are looked up in
  // `latest` at click time, so they never go stale between publishes.
  const signature = actions
    .map(
      (action) =>
        `${action.id} ${action.label} ${action.disabled ? 1 : 0} ${
          action.shortcut ? shortcutLabel(action.shortcut) : ""
        }`,
    )
    .join("");

  useEffect(() => {
    if (!tabId) return;

    publish(
      tabId,
      latest.current.map(({ id, label, icon, disabled, destructive, shortcut }) => ({
        id,
        label,
        ...(icon === undefined ? {} : { icon }),
        ...(disabled === undefined ? {} : { disabled }),
        ...(destructive === undefined ? {} : { destructive }),
        ...(shortcut === undefined ? {} : { shortcut }),
        onSelect: () => {
          latest.current.find((action) => action.id === id)?.onSelect();
        },
      })),
    );

    return () => publish(tabId, null);
  }, [tabId, signature, publish]);
}
