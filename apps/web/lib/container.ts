import "server-only";
import { createContainer, type Container } from "@ajh/app";

// The composition root lives in @ajh/app; the web app keeps one instance across hot reloads.
const globalForContainer = globalThis as unknown as { __ajhContainer?: Container };

export function container(): Container {
  return (globalForContainer.__ajhContainer ??= createContainer());
}
