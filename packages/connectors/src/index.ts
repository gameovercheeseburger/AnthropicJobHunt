import { ConnectorRegistry } from "@ajh/core";
import { AshbyConnector } from "./ashby";
import { GreenhouseConnector } from "./greenhouse";
import { FetchHttpClient } from "./http";
import { LeverConnector } from "./lever";

export * from "./ashby";
export * from "./board-connector";
export * from "./default-sources";
export * from "./greenhouse";
export * from "./http";
export * from "./lever";

/** Factory: the registry of every built-in connector, each with its own polite HTTP client. */
export function createConnectorRegistry(): ConnectorRegistry {
  return new ConnectorRegistry([
    new GreenhouseConnector(new FetchHttpClient()),
    new LeverConnector(new FetchHttpClient()),
    new AshbyConnector(new FetchHttpClient()),
  ]);
}
