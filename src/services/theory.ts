/**
 * Client for the Theory menu API — the sidebar's Theory section and the admin
 * panel that builds it.
 *
 * The public read is a plain `fetch` (no session, no headers); everything that
 * edits goes through the shared `request`, which attaches the Clerk token the
 * server decides the role from.
 */

import { ApiError, request } from "@/services/client";
import type {
  AssignablePresentation,
  MoveDirection,
  TheoryAdminItem,
  TheoryAdminSection,
  TheoryIconName,
  TheoryMenuAdminView,
  TheoryMenuSection,
} from "@/lib/theory/contract";

export type {
  AssignablePresentation,
  TheoryAdminItem,
  TheoryAdminSection,
  TheoryMenuAdminView,
  TheoryMenuSection,
};
export { ApiError as TheoryApiError };

/**
 * The Theory navigation every reader sees. Public, so a signed-out visitor
 * browsing the theory gets the same sidebar.
 */
export async function getTheoryMenu(): Promise<TheoryMenuSection[]> {
  const response = await fetch("/api/theory/menu");
  if (!response.ok) {
    throw new ApiError(response.status, `Request failed with ${response.status}`);
  }

  return (await response.json()) as TheoryMenuSection[];
}

/** The menu plus the approved presentations not in it yet. Admin only. */
export function getTheoryMenuForAdmin(): Promise<TheoryMenuAdminView> {
  return request<TheoryMenuAdminView>("/api/admin/theory/menu");
}

export function createTheorySection(
  label: string,
  icon: TheoryIconName,
): Promise<TheoryAdminSection> {
  return request<TheoryAdminSection>("/api/admin/theory/sections", {
    method: "POST",
    body: JSON.stringify({ label, icon }),
  });
}

export function updateTheorySection(
  id: string,
  label: string,
  icon: TheoryIconName,
): Promise<{ id: string; label: string; icon: TheoryIconName }> {
  return request(`/api/admin/theory/sections/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ label, icon }),
  });
}

/** `-1` moves it up, `1` down. The server swaps and renumbers. */
export function moveTheorySection(
  id: string,
  move: MoveDirection,
): Promise<{ moved: true }> {
  return request(`/api/admin/theory/sections/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ move }),
  });
}

export function deleteTheorySection(id: string): Promise<{ deleted: true }> {
  return request(`/api/admin/theory/sections/${id}`, { method: "DELETE" });
}

/** Files an approved presentation under a section. `label` keeps the title when null. */
export function addTheoryItem(
  sectionId: string,
  presentationId: string,
  label: string | null,
): Promise<TheoryAdminItem> {
  return request<TheoryAdminItem>(`/api/admin/theory/sections/${sectionId}/items`, {
    method: "POST",
    body: JSON.stringify({ presentationId, label }),
  });
}

export function renameTheoryItem(
  id: string,
  label: string | null,
): Promise<{ id: string; label: string | null }> {
  return request(`/api/admin/theory/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ label }),
  });
}

export function moveTheoryItem(
  id: string,
  move: MoveDirection,
): Promise<{ moved: true }> {
  return request(`/api/admin/theory/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ move }),
  });
}

/** Moves an entry to another section, appended at its end. */
export function reassignTheoryItem(
  id: string,
  sectionId: string,
): Promise<{ moved: true }> {
  return request(`/api/admin/theory/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ sectionId }),
  });
}

export function deleteTheoryItem(id: string): Promise<{ deleted: true }> {
  return request(`/api/admin/theory/items/${id}`, { method: "DELETE" });
}
