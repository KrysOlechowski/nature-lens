export const EXTERNAL_HTTP_FETCH = Symbol("EXTERNAL_HTTP_FETCH");
export const EXTERNAL_HTTP_DELAY = Symbol("EXTERNAL_HTTP_DELAY");
export const EXTERNAL_HTTP_RANDOM = Symbol("EXTERNAL_HTTP_RANDOM");

export type ExternalHttpFetch = typeof fetch;
export type ExternalHttpDelay = (delayMs: number) => Promise<void>;
export type ExternalHttpRandom = () => number;
