import type { Repositories, UnitOfWork } from "@ajh/core";
import type { Database, Executor } from "../client";
import { DrizzleApplicationRepository } from "./application-repository";
import { DrizzleJobRepository } from "./job-repository";
import { DrizzleSwipeRepository } from "./swipe-repository";

/** Factory: the full set of repositories bound to one executor (pool or transaction). */
export function createRepositories(db: Executor): Repositories {
  return {
    jobs: new DrizzleJobRepository(db),
    swipes: new DrizzleSwipeRepository(db),
    applications: new DrizzleApplicationRepository(db),
  };
}

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(createRepositories(tx)));
  }
}

export { DrizzleApplicationRepository, DrizzleJobRepository, DrizzleSwipeRepository };
