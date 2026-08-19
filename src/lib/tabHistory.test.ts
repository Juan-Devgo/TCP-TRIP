import { describe, expect, test } from "bun:test";
import {
  canGoBack,
  canGoForward,
  createTabHistory,
  goBack,
  goForward,
  pushPath,
  type TabHistory,
} from "@/lib/tabHistory";

/** Builds the history a tab would hold after walking `paths` in order. */
function walk(...paths: [string, ...string[]]): TabHistory {
  const [first, ...rest] = paths;
  return rest.reduce(pushPath, createTabHistory(first));
}

describe("createTabHistory", () => {
  test("starts on the given path with both stacks empty", () => {
    const history = createTabHistory("/docs");
    expect(history).toEqual({ back: [], current: "/docs", forward: [] });
    expect(canGoBack(history)).toBe(false);
    expect(canGoForward(history)).toBe(false);
  });
});

describe("pushPath", () => {
  test("stacks the previous path behind the new one", () => {
    const history = walk("/docs", "/docs/intro");
    expect(history.back).toEqual(["/docs"]);
    expect(history.current).toBe("/docs/intro");
  });

  test("ignores a push to the path already shown", () => {
    const history = walk("/docs");
    expect(pushPath(history, "/docs")).toBe(history);
  });

  test("drops the forward stack", () => {
    const history = goBack(walk("/docs", "/docs/intro"));
    expect(history.forward).toEqual(["/docs/intro"]);
    expect(pushPath(history, "/docs/tcp").forward).toEqual([]);
  });
});

describe("goBack / goForward", () => {
  test("moves the current path between the two stacks", () => {
    const history = walk("/a", "/b", "/c");

    const back = goBack(history);
    expect(back.current).toBe("/b");
    expect(back.back).toEqual(["/a"]);
    expect(back.forward).toEqual(["/c"]);

    const forward = goForward(back);
    expect(forward).toEqual(history);
  });

  test("walks back to the first path and forward again", () => {
    const history = walk("/a", "/b", "/c");
    const start = goBack(goBack(history));

    expect(start.current).toBe("/a");
    expect(canGoBack(start)).toBe(false);
    expect(goForward(goForward(start))).toEqual(history);
  });

  test("returns the same history when the stack is empty", () => {
    const history = createTabHistory("/a");
    expect(goBack(history)).toBe(history);
    expect(goForward(history)).toBe(history);
  });
});
