import type { Repositories, UnitOfWork } from "@ajh/core";
import type { FieldCipher } from "@ajh/infra";
import type { Database, Executor } from "../client";
import { DrizzleApplicationRepository } from "./application-repository";
import { DrizzleJobRepository } from "./job-repository";
import { DrizzleProfileRepository } from "./profile-repository";
import { DrizzleResumeRepository } from "./resume-repository";
import { DrizzleSwipeRepository } from "./swipe-repository";

/** Factory: the full set of repositories bound to one executor (pool or transaction). */
export function createRepositories(db: Executor, cipher: FieldCipher): Repositories {
  return {
    jobs: new DrizzleJobRepository(db),
    swipes: new DrizzleSwipeRepository(db),
    applications: new DrizzleApplicationRepository(db),
    resumes: new DrizzleResumeRepository(db, cipher),
    profiles: new DrizzleProfileRepository(db),
  };
}

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(
    private readonly db: Database,
    private readonly cipher: FieldCipher,
  ) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(createRepositories(tx, this.cipher)));
  }
}

export {
  DrizzleApplicationRepository,
  DrizzleJobRepository,
  DrizzleProfileRepository,
  DrizzleResumeRepository,
  DrizzleSwipeRepository,
};
