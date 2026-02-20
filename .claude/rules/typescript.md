# TypeScript Rules — Abraxas

Apply these rules for all TypeScript code in this project.

## Type Safety

- Strict mode is enabled — no implicit `any`
- Use `import type` for type-only imports: `import type { Ability } from "@abraxas/shared"`
- No `@ts-ignore` comments — fix the root cause
- No `as any` — narrow properly using type guards or discriminated unions
- Use `EntityType` enum for entity type checks, not `instanceof`, in shared/system code

## File Boundaries

- Types, constants, formulas → `packages/shared/src/`
- Colyseus Schema classes → `apps/server/src/schema/`
- Game logic → `apps/server/src/systems/`
- Message handling → `apps/server/src/handlers/`
- React UI → `apps/client/src/ui/`
- Phaser scenes/managers → `apps/client/src/scenes/` and `apps/client/src/managers/`

Never put:

- Game logic in Schema classes
- Business logic in Phaser scenes (use managers)
- DB queries in systems (use handlers/services)
- Client-specific imports in `@abraxas/shared`

## Naming Conventions

- Classes: `PascalCase`
- Enums: `PascalCase` with `PascalCase` values
- Types/interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Private class members: camelCase (no underscore prefix needed)
- Files: camelCase (e.g., `combatSystem.ts`) or PascalCase for classes (e.g., `CombatSystem.ts`)

## Refactoring Rules

- Do not refactor unrelated code while fixing a bug
- When renaming a shared type, trace all imports in client, server, and shared
- When changing Schema field names, update Colyseus client code and any `onChange` listeners
