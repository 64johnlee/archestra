import fs from "node:fs";
import config from "@/config";
import logger from "@/logging";

const GRANT_TYPE_JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const TOKEN_ENDPOINT = "/v1/oauth/token";

// Beta header required on any API request authenticated with a WIF Bearer token.
export const ANTHROPIC_WIF_OAUTH_BETA_HEADER = "oauth-2025-04-20";

// Beta header that routes /v1/oauth/token POSTs to the jwt-bearer handler.
// Must only be sent on the token exchange request, not on subsequent API calls.
const FEDERATION_BETA_HEADER = "oidc-federation-2026-04-01";

const TOKEN_EXCHANGE_TIMEOUT_MS = 30_000;

// Proactively refresh the cached token 2 minutes before expiry.
const TOKEN_REFRESH_BUFFER_MS = 120_000;

interface CachedToken {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

let cachedWifToken: CachedToken | null = null;

export function isAnthropicWifEnabled(): boolean {
  return config.llm.anthropic.wif.enabled;
}

function readIdentityToken(): string {
  const { identityTokenFile, identityToken } = config.llm.anthropic.wif;

  if (identityTokenFile) {
    try {
      return fs.readFileSync(identityTokenFile, "utf-8").trim();
    } catch (error) {
      throw new Error(
        `Failed to read Anthropic WIF identity token from ${identityTokenFile}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (identityToken) {
    return identityToken;
  }

  throw new Error(
    "Anthropic WIF is enabled but no identity token source is configured. " +
      "Set ARCHESTRA_ANTHROPIC_WIF_IDENTITY_TOKEN_FILE or ARCHESTRA_ANTHROPIC_WIF_IDENTITY_TOKEN.",
  );
}

function isCachedTokenValid(): boolean {
  if (!cachedWifToken) return false;
  return cachedWifToken.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS;
}

async function exchangeToken(): Promise<CachedToken> {
  const { federationRuleId, organizationId, workspaceId } =
    config.llm.anthropic.wif;
  const baseUrl = config.llm.anthropic.baseUrl.replace(/\/$/, "");
  const url = `${baseUrl}${TOKEN_ENDPOINT}`;

  const body: Record<string, string> = {
    grant_type: GRANT_TYPE_JWT_BEARER,
    assertion: readIdentityToken(),
    federation_rule_id: federationRuleId,
    organization_id: organizationId,
  };
  if (workspaceId) {
    body.workspace_id = workspaceId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_EXCHANGE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "anthropic-beta": `${ANTHROPIC_WIF_OAUTH_BETA_HEADER},${FEDERATION_BETA_HEADER}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(
      `Anthropic WIF token exchange failed to reach ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text().catch(() => null);
    }
    const truncated =
      typeof errorBody === "string" && errorBody.length > 256
        ? `${errorBody.slice(0, 256)}…`
        : errorBody;
    throw new Error(
      `Anthropic WIF token exchange failed (HTTP ${response.status}): ${JSON.stringify(truncated)}`,
    );
  }

  let data: { access_token: string; expires_in: number };
  try {
    data = (await response.json()) as typeof data;
  } catch {
    throw new Error(
      `Anthropic WIF token exchange returned non-JSON response (HTTP ${response.status})`,
    );
  }

  if (!data.access_token || !data.expires_in) {
    throw new Error(
      "Anthropic WIF token exchange response is missing required fields (access_token / expires_in)",
    );
  }

  return {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Returns a valid Anthropic Bearer token obtained via WIF.
 *
 * The token is cached and refreshed proactively when within 2 minutes of
 * expiry. The identity token is re-read from disk on every exchange so
 * Kubernetes projected service-account tokens rotate correctly.
 */
export async function getAnthropicWifBearerToken(): Promise<string> {
  if (isCachedTokenValid()) {
    return cachedWifToken!.token;
  }

  logger.debug("Exchanging Anthropic WIF identity token for access token");
  const cached = await exchangeToken();
  cachedWifToken = cached;
  logger.debug(
    { expiresAt: new Date(cached.expiresAt).toISOString() },
    "Anthropic WIF access token obtained",
  );

  return cached.token;
}

/** Exposed for testing only — clears the in-memory token cache. */
export function _resetWifTokenCacheForTest(): void {
  cachedWifToken = null;
}
