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
    throw new Error(`Node-RED API error: ${formatAxiosError(error, method, url)}`);
  }
}

/**
 * Build a human-readable error string from an axios error, including
 * connection code, HTTP status, response body, and the target URL so the
 * user can tell *which* request failed and *why*.
 *
 * Previously this was a single `error.response?.data || error.message`
 * expression, which swallowed crucial details: connection errors have no
 * `error.response`, some Node/axios versions emit an empty `error.message`
 * on ECONNREFUSED, and object response bodies stringify to "[object Object]".
 *
 * @param {Error} error - axios error
 * @param {string} method - HTTP method used for the failed request
 * @param {string} url - full target URL
 * @returns {string}
 */
function formatAxiosError(error, method, url) {
  const parts = [];
  if (error.code) parts.push(error.code);
  if (error.response?.status) {
    const statusText = error.response.statusText ? ` ${error.response.statusText}` : '';
    parts.push(`HTTP ${error.response.status}${statusText}`);
  }
  const body = error.response?.data;
  if (body !== undefined && body !== null && body !== '') {
    parts.push(typeof body === 'string' ? body : JSON.stringify(body));
  } else if (error.message) {
    parts.push(error.message);
  }
  if (parts.length === 0) parts.push('unknown error');
  return `${parts.join(' — ')} (${method.toUpperCase()} ${url})`;
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
