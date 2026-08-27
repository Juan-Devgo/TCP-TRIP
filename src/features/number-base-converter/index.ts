/**
 * Public surface of the number-base converter feature. Everything outside this
 * folder imports from here — `components/`, `lib/` and `exercises/` are
 * internals of the feature.
 */
export { NumberBaseConverter } from "./components/NumberBaseConverter";
export { generateNumberBaseExercises } from "./exercises/numberBaseExercises";
