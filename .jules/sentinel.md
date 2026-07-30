## 2026-07-30 - [Missing Row Level Security for admin operations]
**Vulnerability:** Anyone can delete a community gradient via the supabase API if they know its ID
**Learning:** The 'palettes' table has no Row Level Security applied, while 'palette_likes' does. This allows unauthorized data deletion directly using the Supabase API regardless of frontend checks (e.g. `isAdmin` parameter).
**Prevention:** Apply Row Level Security to all tables containing user-generated content or sensitive data to enforce authorization at the database level.
