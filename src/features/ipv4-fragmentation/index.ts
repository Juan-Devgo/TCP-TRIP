/**
 * Public surface of the IPv4 fragmentation feature. Everything outside this
 * folder imports from here — `components/`, `lib/` and `exercises/` are
 * internals of the feature.
 */
export { IPv4Fragmentation } from "./components/IPv4Fragmentation";
export { generateFragmentationExercises } from "./exercises/fragmentationExercises";
