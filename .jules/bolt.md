## 2023-10-27 - [Gallery Tile Memoization]
**Learning:** In `Gallery.tsx`, `Tile` components receive dynamically generated object props (like the `likes` API object) and closures on every render. This causes O(N) re-renders during frequent parent state updates (like drag-and-drop).
**Action:** Use `React.memo` with a custom equality comparator that strictly checks specific output values (e.g., `likes.isLiked`, `likes.countFor`) instead of object identities.
