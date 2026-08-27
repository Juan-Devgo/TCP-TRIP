/**
 * Public surface of the ASCII converter feature. Everything outside this folder
 * imports from here — `components/`, `lib/` and `exercises/` are internals of
 * the feature.
 */
export { AsciiConverter } from "./components/AsciiConverter";
export { generateAsciiExercises } from "./exercises/asciiExercises";
