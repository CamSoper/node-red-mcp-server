/**
 * Utility tools for the Node-RED MCP server
 */

import axios from 'axios';

/**
 * Call the Node-RED API
 * @param {string} method - HTTP method (get, post, put, delete)
 * @param {string} path - API path
 * @param {Object|null} data - Data to send (optional)
 * @param {Object} config - Connection configuration
 * @returns {Promise<any>} Result of the API call
 */
export async function callNodeRed(method, path, data = null, config) {
  const url = config.nodeRedUrl + path;
  const headers = config.nodeRedToken ? { 'Authorization': 'Bearer ' + config.nodeRedToken } : {};

  try {
    const response = await axios({ method, url, headers, data });
    return response.data;
  } catch (error) {
    const message = error.response?.data || error.message;
    throw new Error(`Node-RED API error: ${message}`);
  }
}

/**
 * Placeholder substituted for any redacted value.
 */
const REDACTED = '[REDACTED]';

/**
 * Substring patterns (matched against normalized key names) that mark a value
 * as sensitive. Keys are lowercased with `_`/`-` stripped before matching, so
 * `credentialSecret`, `credential_secret`, `API-KEY` and `authToken` all match.
 * Note: `credentials` is intentionally omitted so the benign `credentialsFile`
 * filename in Node-RED settings is preserved.
 */
const SENSITIVE_KEY_PATTERNS = ['secret', 'password', 'passwd', 'passphrase', 'token', 'apikey', 'privatekey'];

/**
 * Whether a property name looks sensitive and should have its value redacted.
 * @param {string} key - Property name
 * @returns {boolean}
 */
function isSensitiveKey(key) {
  const normalized = String(key).toLowerCase().replace(/[_-]/g, '');
  return SENSITIVE_KEY_PATTERNS.some(pattern => normalized.includes(pattern));
}

/**
 * Replace credentials embedded in the userinfo of URL-like strings, e.g.
 * `https://user:token@host/repo.git` -> `https://[REDACTED]@host/repo.git`.
 * Leaves strings without embedded credentials unchanged.
 * @param {string} str - Input string
 * @returns {string}
 */
export function scrubUrlCreds(str) {
  return str.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi, `$1${REDACTED}@`);
}

/**
 * Deep-clone a value, redacting any property whose key name looks sensitive
 * (see {@link SENSITIVE_KEY_PATTERNS}) and scrubbing credentials embedded in
 * URL strings. Recurses through plain objects and arrays, returns primitives
 * and null unchanged, never mutates the input, and guards against circular
 * references.
 * @param {*} value - Value to redact
 * @param {WeakSet} [seen] - Internal cycle guard
 * @returns {*} Redacted deep copy
 */
export function redactSensitive(value, seen = new WeakSet()) {
  if (typeof value === 'string') return scrubUrlCreds(value);
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => redactSensitive(item, seen));
  }

  const result = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redactSensitive(val, seen);
  }
  return result;
}

/**
 * Format output of Node-RED flows
 * @param {Array} flows - Array of Node-RED flows
 * @returns {Object} Formatted data with statistics
 */
export function formatFlowsOutput(flows) {
  // Grouping by type
  const result = {
    tabs: flows.filter(n => n.type === 'tab'),
    nodes: flows.filter(n => n.type !== 'tab' && n.type !== 'subflow'),
    subflows: flows.filter(n => n.type === 'subflow')
  };

  // Statistics
  const stats = {
    tabCount: result.tabs.length,
    nodeCount: result.nodes.length,
    subflowCount: result.subflows.length,
    nodeTypes: {}
  };

  result.nodes.forEach(node => {
    if (!stats.nodeTypes[node.type]) stats.nodeTypes[node.type] = 0;
    stats.nodeTypes[node.type]++;
  });

  return {
    summary: `Node-RED project: ${stats.tabCount} tabs, ${stats.nodeCount} nodes, ${stats.subflowCount} subflows`,
    statistics: stats,
    data: result
  };
}
