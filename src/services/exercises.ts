import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ExerciseSet, ExerciseSetInput } from "@/lib/exercises/sets";
import { request } from "@/services/client";

/**
 * Query hooks for teacher-authored exercise sets. `Crear ejercicios` writes,
 * `Mis ejercicios` and `Asignar` read the same `['exercises']` key, so a save
 * in one tab shows up in the others without any message passing.
 */

export const exerciseKeys = {
  all: ["exercises"] as const,
  one: (id: string) => ["exercises", id] as const,
};

export function useExerciseSets(enabled = true) {
  return useQuery({
    queryKey: exerciseKeys.all,
    queryFn: () => request<ExerciseSet[]>("/api/exercises"),
    enabled,
  });
}

export function useExerciseSet(id: string | null) {
  return useQuery({
    queryKey: exerciseKeys.one(id ?? ""),
    queryFn: () => request<ExerciseSet>(`/api/exercises/${encodeURIComponent(id ?? "")}`),
    enabled: id !== null,
  });
}

export function useSaveExerciseSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: ExerciseSetInput }) =>
      id
        ? request<ExerciseSet>(`/api/exercises/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(input),
          })
        : request<ExerciseSet>("/api/exercises", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exerciseKeys.all }),
  });
}

export function useDuplicateExerciseSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      request<ExerciseSet>(`/api/exercises/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exerciseKeys.all }),
  });
}

export function useDeleteExerciseSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request<{ deleted: true }>(`/api/exercises/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exerciseKeys.all }),
  });
}
