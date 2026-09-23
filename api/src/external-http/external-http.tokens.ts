export const EXTERNAL_HTTP_FETCH = Symbol("EXTERNAL_HTTP_FETCH");
export const EXTERNAL_HTTP_TIMEOUT_MS = Symbol("EXTERNAL_HTTP_TIMEOUT_MS");

export type ExternalHttpFetch = typeof fetch;
