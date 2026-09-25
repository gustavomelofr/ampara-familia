// Native builds have no hosted web origin, so they must never mount expo-router/head.
export function WebTitle() {
  return null;
}
