/**
 * Cloudflare Access JWT validation middleware for the Streamable HTTP transport.
 *
 * This server has no auth of its own; in the home-lab deployment it sits behind
 * Cloudflare Access ("Managed OAuth"). Access authenticates the user at the edge
 * and injects a signed `Cf-Access-Jwt-Assertion` header on every request it
 * forwards to the origin. Validating that JWT here closes the "confused deputy"
 * gap: without it, anything that can reach the HTTP port on the docker network is
 * trusted to drive Node-RED (the server applies its own NODE_RED_TOKEN regardless
 * of who called). With it, a request that did NOT traverse Access -- a sibling
 * container, a future published port, a misconfig -- is rejected before any tool
 * runs.
 *
 * Enforcement is enabled only when BOTH `CF_ACCESS_TEAM_DOMAIN` and
 * `CF_ACCESS_AUD` are set. When either is missing the middleware is a no-op (so
 * the Access edge remains the sole control and a deploy can't lock you out before
 * the env is wired) but it logs a loud warning at startup.
 *
 * Wiring: the Access app and its AUD tag are defined in domain-infra
 * (Account/McpAccess.cs, exported as the `mcpAccessAud` stack output); home-lab-iac
 * (ContainerConfigs/Server/NodeRedMcp.cs) injects CF_ACCESS_AUD from that output
 * and CF_ACCESS_TEAM_DOMAIN from config.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';

function unauthorized(res, message) {
  res.status(401).json({
    jsonrpc: '2.0',
    error: { code: -32001, message: `Unauthorized: ${message}` },
    id: null
  });
}

/**
 * Builds the Access-JWT express middleware.
 * @param {Object} opts
 * @param {string} opts.teamDomain - Cloudflare Zero Trust team domain, e.g. `acme.cloudflareaccess.com`.
 * @param {string} opts.aud - The Access application's AUD tag.
 * @param {boolean} [opts.verbose] - Log the (non-secret) enforcement parameters at startup.
 * @returns {Function} express middleware
 */
export function createAccessJwtMiddleware({ teamDomain, aud, verbose = false } = {}) {
  if (!teamDomain || !aud) {
    // eslint-disable-next-line no-console
    console.error(
      '[access-jwt] WARNING: Cloudflare Access JWT validation is DISABLED ' +
      '(set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD to enable). The MCP origin ' +
      'will trust any caller that can reach it; the Access edge is the only control.'
    );
    return (_req, _res, next) => next();
  }

  const issuer = `https://${teamDomain}`;
  // createRemoteJWKSet fetches and caches Cloudflare's signing keys (and refreshes
  // on key rotation / unknown kid), so verification is local after the first hit.
  const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));

  if (verbose) {
    // eslint-disable-next-line no-console
    console.error(`[access-jwt] enforcing Cloudflare Access JWT (iss=${issuer}, aud=${aud})`);
  }

  return async function accessJwt(req, res, next) {
    const cookieMatch = req.headers.cookie && /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(req.headers.cookie);
    const token = req.headers[ACCESS_JWT_HEADER] || (cookieMatch && cookieMatch[1]);

    if (!token) {
      unauthorized(res, 'missing Cloudflare Access token');
      return;
    }

    try {
      // jwtVerify checks the signature against the JWKS plus exp/nbf; issuer and
      // audience pin the token to THIS Access app (a valid token minted for some
      // other app on the same team is rejected).
      await jwtVerify(token, jwks, { issuer, audience: aud });
      next();
    } catch (_err) {
      unauthorized(res, 'invalid Cloudflare Access token');
    }
  };
}
