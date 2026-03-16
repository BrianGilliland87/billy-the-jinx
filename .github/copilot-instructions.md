# Billy the Jinx repository instructions

This repository contains:
- Expo / React Native mobile app in `apps/mobile`
- Next.js admin app in `apps/admin`
- Supabase backend and SQL schema
- GitHub-backed beta build

Project goals:
- entertainment-only sports fan app
- Billy the Jinx is fictional
- preserve snack balance accuracy
- preserve bracket and event integrity
- prefer small, safe changes
- do not rewrite architecture unless explicitly asked

Coding rules:
- use TypeScript
- keep mobile screens simple and readable
- prefer existing project patterns over inventing new ones
- do not remove legal/disclaimer text
- do not hardcode secrets
- keep Supabase client-side code limited to anon-safe operations
- preserve event status rules: open, locked, final
- preserve Billy logic and curse resolution behavior
- avoid unnecessary dependency additions

Testing checklist for changes:
- mobile app should still load in Expo
- admin app should still load in Next.js
- event flows should not break
- auth/profile logic should remain intact