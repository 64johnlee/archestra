import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WIF_CONFIG_BASE = {
  llm: {
    anthropic: {
      baseUrl: "https://api.anthropic.com",
      wif: {
        enabled: true,
        identityTokenFile: "",
        identityToken: "test-oidc-jwt",
        federationRuleId: "rule-123",
        organizationId: "org-456",
        workspaceId: "",
      },
    },
  },
};

describe("anthropic-credentials", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe("isAnthropicWifEnabled", () => {
    it("returns false when disabled", async () => {
      vi.doMock("@/config", () => ({
        default: {
          llm: {
            anthropic: {
              wif: { enabled: false },
            },
          },
        },
      }));
      const { isAnthropicWifEnabled } = await import("./anthropic-credentials");
      expect(isAnthropicWifEnabled()).toBe(false);
    });

    it("returns true when enabled", async () => {
      vi.doMock("@/config", () => ({
        default: {
          llm: {
            anthropic: {
              wif: { enabled: true },
            },
          },
        },
      }));
      const { isAnthropicWifEnabled } = await import("./anthropic-credentials");
      expect(isAnthropicWifEnabled()).toBe(true);
    });
  });

  describe("getAnthropicWifBearerToken", () => {
    beforeEach(() => {
      vi.doMock("@/config", () => ({ default: WIF_CONFIG_BASE }));
    });

    it("exchanges the identity token for an Anthropic access token", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "ant-access-token-abc123",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getAnthropicWifBearerToken, _resetWifTokenCacheForTest } =
        await import("./anthropic-credentials");
      _resetWifTokenCacheForTest();

      const token = await getAnthropicWifBearerToken();

      expect(token).toBe("ant-access-token-abc123");
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.anthropic.com/v1/oauth/token");
      expect((init.headers as Record<string, string>)["anthropic-beta"]).toMatch(
        "oauth-2025-04-20",
      );
      expect((init.headers as Record<string, string>)["anthropic-beta"]).toMatch(
        "oidc-federation-2026-04-01",
      );

      const body = JSON.parse(init.body as string);
      expect(body.grant_type).toBe(
        "urn:ietf:params:oauth:grant-type:jwt-bearer",
      );
      expect(body.assertion).toBe("test-oidc-jwt");
      expect(body.federation_rule_id).toBe("rule-123");
      expect(body.organization_id).toBe("org-456");
      expect(body.workspace_id).toBeUndefined();
    });

    it("includes workspace_id when configured", async () => {
      vi.doMock("@/config", () => ({
        default: {
          ...WIF_CONFIG_BASE,
          llm: {
            anthropic: {
              ...WIF_CONFIG_BASE.llm.anthropic,
              wif: {
                ...WIF_CONFIG_BASE.llm.anthropic.wif,
                workspaceId: "wrkspc-789",
              },
            },
          },
        },
      }));

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "ant-ws-token",
          expires_in: 3600,
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getAnthropicWifBearerToken, _resetWifTokenCacheForTest } =
        await import("./anthropic-credentials");
      _resetWifTokenCacheForTest();

      await getAnthropicWifBearerToken();

      const body = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
      );
      expect(body.workspace_id).toBe("wrkspc-789");
    });

    it("caches the token until near expiry", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "cached-token",
          expires_in: 3600,
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getAnthropicWifBearerToken, _resetWifTokenCacheForTest } =
        await import("./anthropic-credentials");
      _resetWifTokenCacheForTest();

      await getAnthropicWifBearerToken();
      await getAnthropicWifBearerToken();

      // Should only exchange once — second call hits cache.
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it("throws when the token endpoint returns an error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "invalid_assertion" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getAnthropicWifBearerToken, _resetWifTokenCacheForTest } =
        await import("./anthropic-credentials");
      _resetWifTokenCacheForTest();

      await expect(getAnthropicWifBearerToken()).rejects.toThrow(
        /WIF token exchange failed \(HTTP 401\)/,
      );
    });

    it("throws when the response is missing required fields", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token_type: "Bearer" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getAnthropicWifBearerToken, _resetWifTokenCacheForTest } =
        await import("./anthropic-credentials");
      _resetWifTokenCacheForTest();

      await expect(getAnthropicWifBearerToken()).rejects.toThrow(
        /missing required fields/,
      );
    });

    it("throws when no identity token source is configured", async () => {
      vi.doMock("@/config", () => ({
        default: {
          llm: {
            anthropic: {
              baseUrl: "https://api.anthropic.com",
              wif: {
                enabled: true,
                identityTokenFile: "",
                identityToken: "",
                federationRuleId: "rule-123",
                organizationId: "org-456",
                workspaceId: "",
              },
            },
          },
        },
      }));

      const { getAnthropicWifBearerToken, _resetWifTokenCacheForTest } =
        await import("./anthropic-credentials");
      _resetWifTokenCacheForTest();

      await expect(getAnthropicWifBearerToken()).rejects.toThrow(
        /no identity token source is configured/,
      );
    });
  });
});
