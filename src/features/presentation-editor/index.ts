/**
 * Public surface of the presentation editor feature. Everything outside this
 * folder imports from here — `components/` and `lib/` are internals.
 */
export { PresentationEditor } from "./components/PresentationEditor";
export { MyPresentations, draftIdFromPath } from "./components/MyPresentations";
export type { EditorState, EditorAction } from "./lib/editorState";
