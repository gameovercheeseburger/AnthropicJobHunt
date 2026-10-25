# Architecture

AnthropicJobHunt is a layered (hexagonal) monorepo. Dependencies point inward:

```
apps/web (UI, server actions)  ──►  packages/core (domain, ports, services)  ◄──  packages/db (adapters)
             │                                                                        ▲
             └──────────── lib/container.ts (composition root) wires them ────────────┘
```

`packages/core` imports nothing from Next.js, Drizzle, or any SDK. That is what keeps the
business rules (swipe outcomes, and later the no-fabrication validator) fast to test and easy to change.

## Design patterns and where they live

| Pattern | Where | Rule |
|---|---|---|
| **Repository** | ports: `packages/core/src/ports/repositories.ts`; adapters: `packages/db/src/repositories/*` | No code outside `packages/db` queries the database. |
| **Unit of Work** | `UnitOfWork` port, `DrizzleUnitOfWork` | Multi-step writes (e.g. swipe + application) run in one transaction. |
| **Service layer** | `packages/core/src/services/*` | Each use case is a method on a service. Server actions only validate input and call a service. |
| **Dependency injection / Composition root** | `apps/web/lib/container.ts` | The only place concrete classes are constructed. Services receive interfaces through constructors. |
| **Factory** | `createRepositories(executor)` | Builds a repository set bound to the pool or to a transaction. |
| **Value object** | `Salary` in `packages/core/src/domain/job.ts` | Immutable, validated at creation, owns its formatting. |
| **Presenter** | `apps/web/lib/presenters/*` | Converts domain objects into plain, serializable view models for client components. |
| **Strategy** | `resolveSwipe` (gesture → decision). Upcoming: one `SourceConnector` per job source, one `EmbeddingProvider` and `LlmProvider` per vendor | Interchangeable algorithms behind one interface. |
| **Adapter + Registry** *(next steps)* | `packages/core/src/connectors` | Each job source adapts its API to `NormalizedJobInput`; the registry looks connectors up by key. |
| **Test doubles** | `packages/core/test/fakes.ts` | In-memory implementations of every port. Services are tested without a database. |

## Adding a feature: checklist

1. Domain types / value objects in `core/src/domain`.
2. Port interface in `core/src/ports` if new persistence or an external system is needed.
3. Service in `core/src/services` + unit tests against fakes.
4. Adapter in `packages/db` (or a new package for external APIs).
5. Wire it in `apps/web/lib/container.ts`.
6. UI: server component / server action calls the service; presenter shapes the data.

## Swipe semantics

| Gesture | Key | Result |
|---|---|---|
| Swipe right | → | Application created with status `queued` (AI tailoring is the next step) |
| Swipe up | ↑ | Application created with status `saved` |
| Swipe left | ← | Pass. No application, and the job leaves the deck |
| Undo | Z / Backspace | Reverts the last swipe, unless the user already moved that application forward |

A swipe never downgrades an application the user has progressed (applied, interviewing, etc.).
