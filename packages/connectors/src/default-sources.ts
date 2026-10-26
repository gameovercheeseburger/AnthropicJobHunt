import type { SourceKind } from "@ajh/core";
import type { BoardRef } from "./board-connector";
import type { JSearchConfig } from "./jsearch";

/**
 * Google for Jobs searches (via JSearch) covering LinkedIn, Indeed, Glassdoor and Job Bank postings.
 * Sized for a small RapidAPI plan: 6 requests per daily run ≈ 180/month. Raise `maxRequestsPerRun`
 * (and add queries) on a bigger plan. The admin can edit these in the `sources` table.
 */
export const DEFAULT_JSEARCH_SOURCE: { key: string; name: string; kind: SourceKind; config: JSearchConfig } = {
  key: "jsearch",
  name: "Google for Jobs (JSearch: LinkedIn, Indeed, Job Bank, …)",
  kind: "aggregator",
  config: {
    queries: [
      "software developer jobs in Canada",
      "data analyst jobs in Canada",
      "project manager jobs in Canada",
      "IT support jobs in Canada",
      "business analyst jobs in Canada",
      "marketing jobs in Canada",
    ],
    country: "ca",
    datePosted: "3days",
    pagesPerQuery: 1,
    maxRequestsPerRun: 6,
  },
};

/**
 * Starting set of public career boards with roles located in Canada (verified 2026-10-25).
 * Seeded into the `sources` table; the admin can add or remove boards later without a deploy.
 */
export const DEFAULT_SOURCES: Array<{ key: string; name: string; kind: SourceKind; boards: BoardRef[] }> = [
  {
    key: "greenhouse",
    name: "Greenhouse career boards",
    kind: "ats",
    boards: [
      { token: "affirm", name: "Affirm" },
      { token: "okta", name: "Okta" },
      { token: "lyft", name: "Lyft" },
      { token: "gitlab", name: "GitLab" },
      { token: "stripe", name: "Stripe" },
      { token: "instacart", name: "Instacart" },
      { token: "brex", name: "Brex" },
      { token: "elastic", name: "Elastic" },
      { token: "samsara", name: "Samsara" },
      { token: "asana", name: "Asana" },
      { token: "databricks", name: "Databricks" },
      { token: "geotab", name: "Geotab" },
      { token: "mozilla", name: "Mozilla" },
      { token: "robinhood", name: "Robinhood" },
      { token: "mongodb", name: "MongoDB" },
      { token: "toast", name: "Toast" },
      { token: "faire", name: "Faire" },
      { token: "airbnb", name: "Airbnb" },
      { token: "reddit", name: "Reddit" },
      { token: "pinterest", name: "Pinterest" },
      { token: "carta", name: "Carta" },
      { token: "coinbase", name: "Coinbase" },
      { token: "d2l", name: "D2L" },
      { token: "dropbox", name: "Dropbox" },
      { token: "twilio", name: "Twilio" },
      { token: "gusto", name: "Gusto" },
      { token: "datadog", name: "Datadog" },
    ],
  },
  {
    key: "lever",
    name: "Lever career boards",
    kind: "ats",
    boards: [{ token: "spotify", name: "Spotify" }],
  },
  {
    key: "ashby",
    name: "Ashby career boards",
    kind: "ats",
    boards: [
      { token: "cohere", name: "Cohere" },
      { token: "1password", name: "1Password" },
      { token: "wealthsimple", name: "Wealthsimple" },
      { token: "jane", name: "Jane" },
      { token: "ramp", name: "Ramp" },
      { token: "float", name: "Float" },
      { token: "sanity", name: "Sanity" },
    ],
  },
];
