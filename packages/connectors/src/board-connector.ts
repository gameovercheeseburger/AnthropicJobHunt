import type { NormalizedJobInput, ScopeResult, SourceConnector, SourceDefinition } from "@ajh/core";
import type { HttpClient } from "./http";

/** A company board on an ATS: `token` is the board's id on that platform, `name` the display name. */
export interface BoardRef {
  token: string;
  name?: string;
}

export function boardsFromConfig(config: Record<string, unknown>): BoardRef[] {
  const boards = config.boards;
  if (!Array.isArray(boards)) return [];
  return boards
    .map((b) => (typeof b === "string" ? { token: b } : (b as BoardRef)))
    .filter((b) => typeof b?.token === "string" && /^[a-z0-9_.-]+$/i.test(b.token));
}

/**
 * Template Method: every public-ATS connector walks the source's boards and turns each into a
 * ScopeResult. Subclasses only implement fetching and normalizing one board.
 */
export abstract class BoardConnector implements SourceConnector {
  abstract readonly key: string;

  constructor(protected readonly http: HttpClient) {}

  protected abstract fetchBoard(board: BoardRef): Promise<NormalizedJobInput[]>;

  async *fetch(source: SourceDefinition): AsyncIterable<ScopeResult> {
    for (const board of boardsFromConfig(source.config)) {
      try {
        yield { scope: board.token, ok: true, jobs: await this.fetchBoard(board) };
      } catch (err) {
        yield { scope: board.token, ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }
}

/** Title-cases a board token for display when no name is configured ("dapperlabs" → "Dapperlabs"). */
export const displayName = (board: BoardRef) =>
  board.name ?? board.token.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
