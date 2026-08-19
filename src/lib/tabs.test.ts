import { describe, expect, test } from "bun:test";
import {
  findTab,
  INITIAL_TABS_STATE,
  tabsReducer,
  urlRealignTarget,
  type TabsState,
} from "@/lib/tabs";

const CONVERTER = "/tools/converters/number-bases";
const MESSAGES = "/messages";
const BUILDER = "/protocol/new";

type Session = { state: TabsState; pathname: string };

let ids = 0;

/**
 * Drives the two effects `TabsProvider` runs — URL → tabs and tabs → URL —
 * until neither has anything left to do, which is also the proof that they
 * cannot ping-pong.
 *
 * Both effects read `rendered`, the single snapshot of the commit they run in.
 * That is the whole point of this harness: React does not hand the second
 * effect the state the first one just dispatched, and sequencing them here
 * would hide exactly the bugs this suite exists to catch.
 */
function settle(session: Session, maxSteps = 8): Session {
  let { state, pathname } = session;

  for (let step = 0; step < maxSteps; step++) {
    const rendered = { state, pathname };
    let moved = false;

    if (rendered.pathname !== rendered.state.syncedPath) {
      state = tabsReducer(state, {
        type: "sync",
        path: rendered.pathname,
        newTabId: `tab-${(ids += 1)}`,
      });
      moved = true;
    }

    const target = urlRealignTarget(rendered.state, rendered.pathname);
    if (target !== null) {
      pathname = target;
      moved = true;
    }

    if (!moved) return { state, pathname };
  }

  throw new Error(`tab state never settled (stuck at ${pathname})`);
}

/** Types a URL into the address bar / clicks a sidebar or breadcrumb link. */
function go(session: Session, path: string): Session {
  return settle({ ...session, pathname: path });
}

/** Applies a user action on the tab bar, then lets the URL catch up. */
function act(session: Session, action: Parameters<typeof tabsReducer>[1]): Session {
  return settle({ ...session, state: tabsReducer(session.state, action) });
}

const HOME: Session = settle({ state: INITIAL_TABS_STATE, pathname: "/" });

function titles(session: Session): string[] {
  return session.state.tabs.map((tab) => tab.rootPath);
}

function activePath(session: Session): string | null {
  return findTab(session.state, session.state.activeTabId)?.rootPath ?? null;
}

describe("opening pages", () => {
  test("a page path opens a tab and activates it", () => {
    const session = go(HOME, CONVERTER);

    expect(titles(session)).toEqual([CONVERTER]);
    expect(activePath(session)).toBe(CONVERTER);
    expect(session.pathname).toBe(CONVERTER);
  });

  test("reopening a page focuses its tab instead of duplicating it", () => {
    const opened = go(go(HOME, CONVERTER), MESSAGES);
    const session = go(opened, CONVERTER);

    expect(titles(session)).toEqual([CONVERTER, MESSAGES]);
    expect(activePath(session)).toBe(CONVERTER);
  });

  test("focusing a tab restores the path it had navigated to", () => {
    let session = go(HOME, MESSAGES);
    session = go(session, "/messages/42"); // in-tab navigation
    session = go(session, BUILDER);

    session = go(session, MESSAGES); // sidebar click on an open page

    expect(titles(session)).toEqual([MESSAGES, BUILDER]);
    expect(session.pathname).toBe("/messages/42");
  });

  test("home keeps the tabs open with none active", () => {
    const session = go(go(HOME, CONVERTER), "/");

    expect(titles(session)).toEqual([CONVERTER]);
    expect(session.state.activeTabId).toBeNull();
    expect(session.pathname).toBe("/");
  });
});

// Every `settle` already throws if the two effects keep undoing each other, so
// these read as ordinary assertions; each one used to bounce the URL forever
// between the old page and the new one.
describe("links never bounce the URL", () => {
  test("the home link from an open tab", () => {
    const session = go(go(HOME, CONVERTER), "/");

    expect(session.pathname).toBe("/");
    expect(session.state.activeTabId).toBeNull();
  });

  test("a sidebar link to another page while a tab is open", () => {
    const session = go(go(HOME, CONVERTER), MESSAGES);

    expect(session.pathname).toBe(MESSAGES);
    expect(activePath(session)).toBe(MESSAGES);
  });

  test("a breadcrumb link to a page that is already open", () => {
    let session = go(go(HOME, MESSAGES), "/messages/42");
    session = go(session, MESSAGES);

    // Focusing an open page keeps its place (CA-2), so the URL settles back on
    // where the tab was — the point here is only that it settles at all.
    expect(session.pathname).toBe("/messages/42");
    expect(session.state.tabs).toHaveLength(1);
  });

  test("home, then straight back into the tab that stayed open", () => {
    let session = go(go(HOME, CONVERTER), "/");
    session = go(session, CONVERTER);

    expect(session.pathname).toBe(CONVERTER);
    expect(session.state.tabs).toHaveLength(1);
  });
});

describe("navigating inside a tab", () => {
  test("an unregistered path lands on the active tab's history", () => {
    const session = go(go(HOME, MESSAGES), "/messages/42");
    const tab = session.state.tabs[0];

    expect(session.state.tabs).toHaveLength(1);
    expect(tab?.history).toEqual({
      back: [MESSAGES],
      current: "/messages/42",
      forward: [],
    });
  });

  test("back and forward move the tab and the URL together", () => {
    let session = go(go(HOME, MESSAGES), "/messages/42");

    session = act(session, { type: "back" });
    expect(session.pathname).toBe(MESSAGES);

    session = act(session, { type: "forward" });
    expect(session.pathname).toBe("/messages/42");
  });

  test("each tab keeps its own history", () => {
    let session = go(go(HOME, MESSAGES), "/messages/42");
    session = go(session, BUILDER);

    // The builder tab has nowhere to go back to...
    session = act(session, { type: "back" });
    expect(session.pathname).toBe(BUILDER);

    // ...while the messages tab still remembers its own trail.
    session = go(session, MESSAGES);
    session = act(session, { type: "back" });
    expect(session.pathname).toBe(MESSAGES);
    expect(findTab(session.state, session.state.activeTabId)?.history.forward).toEqual(
      ["/messages/42"],
    );
  });
});

describe("closing tabs", () => {
  function threeTabs(): Session {
    return go(go(go(HOME, CONVERTER), MESSAGES), BUILDER);
  }

  test("closing the active tab focuses its right neighbour", () => {
    const session = threeTabs();
    const middle = session.state.tabs[1];

    const focused = act(session, { type: "activate", id: middle?.id ?? "" });
    const closed = act(focused, { type: "close", id: middle?.id ?? "" });

    expect(titles(closed)).toEqual([CONVERTER, BUILDER]);
    expect(activePath(closed)).toBe(BUILDER);
  });

  test("closing the rightmost tab falls back to the left neighbour", () => {
    const session = threeTabs(); // the builder tab is already active
    const last = session.state.tabs[2];

    const closed = act(session, { type: "close", id: last?.id ?? "" });

    expect(activePath(closed)).toBe(MESSAGES);
  });

  test("closing a background tab leaves the active one alone", () => {
    const session = threeTabs();
    const first = session.state.tabs[0];

    const closed = act(session, { type: "close", id: first?.id ?? "" });

    expect(titles(closed)).toEqual([MESSAGES, BUILDER]);
    expect(activePath(closed)).toBe(BUILDER);
  });

  test("closing the last tab returns to the home screen", () => {
    const session = go(HOME, CONVERTER);
    const only = session.state.tabs[0];

    const closed = act(session, { type: "close", id: only?.id ?? "" });

    expect(closed.state.tabs).toEqual([]);
    expect(closed.state.activeTabId).toBeNull();
    expect(closed.pathname).toBe("/");
  });

  test("a closed tab loses its history — reopening starts fresh", () => {
    let session = go(go(HOME, MESSAGES), "/messages/42");
    const tab = session.state.tabs[0];

    session = act(session, { type: "close", id: tab?.id ?? "" });
    session = go(session, MESSAGES);

    expect(session.state.tabs[0]?.history).toEqual({
      back: [],
      current: MESSAGES,
      forward: [],
    });
  });
});

describe("reordering tabs", () => {
  test("moving a tab changes only the order", () => {
    const session = go(go(go(HOME, CONVERTER), MESSAGES), BUILDER);

    const moved = act(session, { type: "move", from: 2, to: 0 });

    expect(titles(moved)).toEqual([BUILDER, CONVERTER, MESSAGES]);
    expect(activePath(moved)).toBe(BUILDER);
    expect(moved.pathname).toBe(BUILDER);
  });

  test("an out-of-range move is ignored", () => {
    const session = go(HOME, CONVERTER);
    expect(act(session, { type: "move", from: 5, to: 0 }).state.tabs).toEqual(
      session.state.tabs,
    );
  });
});

describe("deep links", () => {
  test("an unknown path with nothing open still gets a tab", () => {
    const session = go(HOME, "/tools/converters/unknown");

    expect(titles(session)).toEqual(["/tools/converters/unknown"]);
    expect(session.state.activeTabId).not.toBeNull();
  });
});
