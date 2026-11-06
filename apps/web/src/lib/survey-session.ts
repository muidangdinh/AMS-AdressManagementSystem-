const ACTIVE_ASSIGNMENT_KEY = 'tayninh_active_assignment';

export function getActiveAssignmentId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_ASSIGNMENT_KEY);
}

export function setActiveAssignmentId(id: string): void {
  window.localStorage.setItem(ACTIVE_ASSIGNMENT_KEY, id);
}

export function clearActiveAssignmentId(): void {
  window.localStorage.removeItem(ACTIVE_ASSIGNMENT_KEY);
}
