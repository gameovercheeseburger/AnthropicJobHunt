export const USER_AGENT = "AnthropicJobHunt/0.1 (job aggregator; +https://github.com/gameovercheeseburger/AnthropicJobHunt)";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} from ${new URL(url).host}`);
  }
}

export interface HttpClient {
  getJson<T>(url: string): Promise<T>;
}

export interface FetchHttpClientOptions {
  /** Minimum gap between requests from this client, to stay polite to the source. */
  minIntervalMs?: number;
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
}

/** Polite JSON client: identifies itself, spaces requests, times out, and retries 429/5xx with backoff. */
export class FetchHttpClient implements HttpClient {
  private nextSlot = 0;
  private readonly opts: Required<FetchHttpClientOptions>;

  constructor(options: FetchHttpClientOptions = {}) {
    this.opts = {
      minIntervalMs: options.minIntervalMs ?? 250,
      timeoutMs: options.timeoutMs ?? 20_000,
      retries: options.retries ?? 2,
      fetchImpl: options.fetchImpl ?? fetch,
    };
  }

  async getJson<T>(url: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      let res: Response;
      try {
        res = await this.opts.fetchImpl(url, {
          headers: { Accept: "application/json", "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(this.opts.timeoutMs),
        });
      } catch (err) {
        if (attempt < this.opts.retries) {
          await sleep(backoff(attempt));
          continue;
        }
        throw err;
      }
      if (res.ok) return (await res.json()) as T;
      if ((res.status === 429 || res.status >= 500) && attempt < this.opts.retries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
        continue;
      }
      throw new HttpError(res.status, url);
    }
  }

  private async throttle() {
    const now = Date.now();
    const wait = this.nextSlot - now;
    this.nextSlot = Math.max(now, this.nextSlot) + this.opts.minIntervalMs;
    if (wait > 0) await sleep(wait);
  }
}

const backoff = (attempt: number) => 500 * 2 ** attempt;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
