## 2025-08-06 - Missing Aria Labels on Block Stack Component Remove Action
**Learning:** Found an accessibility issue pattern specific to this app's components, where the `remove` action for individual `BlockStack` blocks was a button containing just a `×` and no `aria-label`, so a screen reader user wouldn't know which color block they are attempting to remove.
**Action:** Always verify components that map array elements containing remove buttons to ensure they are adequately described with `aria-label` values relative to their respective items.
