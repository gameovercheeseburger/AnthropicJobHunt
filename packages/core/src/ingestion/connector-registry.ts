import type { SourceConnector } from "../ports/ingestion";

/** Registry: connectors are looked up by the `key` stored on each source row. */
export class ConnectorRegistry {
  private readonly connectors = new Map<string, SourceConnector>();

  constructor(connectors: SourceConnector[] = []) {
    connectors.forEach((c) => this.register(c));
  }

  register(connector: SourceConnector): this {
    if (this.connectors.has(connector.key)) throw new Error(`Connector "${connector.key}" registered twice`);
    this.connectors.set(connector.key, connector);
    return this;
  }

  get(key: string): SourceConnector {
    const connector = this.connectors.get(key);
    if (!connector) throw new Error(`No connector registered for source "${key}"`);
    return connector;
  }

  keys(): string[] {
    return [...this.connectors.keys()];
  }
}
