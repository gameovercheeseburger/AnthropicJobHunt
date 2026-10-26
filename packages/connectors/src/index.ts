import { ConnectorRegistry } from "@ajh/core";
import { AshbyConnector } from "./ashby";
import { GreenhouseConnector } from "./greenhouse";
import { FetchHttpClient } from "./http";
import { JSearchConnector } from "./jsearch";
import { LeverConnector } from "./lever";

export * from "./ashby";
export * from "./board-connector";
export * from "./default-sources";
export * from "./greenhouse";
export * from "./http";
export * from "./jsearch";
export * from "./lever";

export interface ConnectorKeys {
  /** RapidAPI key for JSearch (Google for Jobs). Without it, JSearch is simply not registered. */
  jsearchApiKey?: string;
}

/** Factory: the registry of every available connector, each with its own polite HTTP client. */
export function createConnectorRegistry(keys: ConnectorKeys = {}): ConnectorRegistry {
  const registry = new ConnectorRegistry([
    new GreenhouseConnector(new FetchHttpClient()),
    new LeverConnector(new FetchHttpClient()),
    new AshbyConnector(new FetchHttpClient()),
  ]);
  if (keys.jsearchApiKey) {
    registry.register(
      new JSearchConnector(
        new FetchHttpClient({
          minIntervalMs: 1100, // stay well under RapidAPI per-second limits
          headers: { "x-rapidapi-key": keys.jsearchApiKey, "x-rapidapi-host": "jsearch.p.rapidapi.com" },
        }),
      ),
    );
  }
  return registry;
}
