/**
 * MCP server for Node-RED
 * Allows language models to interact with Node-RED through the MCP protocol
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import express from 'express';
import 'dotenv/config';
import axios from 'axios';

// Import tool registrars
import registerFlowTools from './tools/flows.mjs';
import registerNodeTools from './tools/nodes.mjs';
import registerSettingsTools from './tools/settings.mjs';
import registerUtilityTools from './tools/utility.mjs';

/**
 * Default server settings
 */
const defaultConfig = {
  serverName: 'node-red-mcp-server',
  serverVersion: '1.0.0',
  nodeRedUrl: 'http://localhost:1880',
  nodeRedToken: '',
  transportType: 'stdio',
  httpPort: 3000,
  httpPath: '/mcp',
  verbose: false
};

/**
 * Builds a fresh McpServer instance with all Node-RED tools registered.
 * A new instance is created per stdio process and per HTTP session.
 * @param {Object} config - Resolved server configuration
 * @returns {McpServer}
 */
function createMcpServer(config) {
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion
  });

  registerFlowTools(server, config);
  registerNodeTools(server, config);
  registerSettingsTools(server, config);
  registerUtilityTools(server, config);

  return server;
}

/**
 * Creates and configures an MCP server for Node-RED
 * @param {Object} userConfig - User configuration
 * @returns {Object} Object with start method and other utilities
 */
export function createServer(userConfig = {}) {
  // Merge configuration
  const config = {
    ...defaultConfig,
    ...userConfig,
    nodeRedUrl: userConfig.nodeRedUrl || process.env.NODE_RED_URL || defaultConfig.nodeRedUrl,
    nodeRedToken: userConfig.nodeRedToken || process.env.NODE_RED_TOKEN || defaultConfig.nodeRedToken
  };

  // Build a server eagerly for stdio mode and programmatic access. HTTP mode
  // builds a fresh server per session instead (see startHttp).
  const server = createMcpServer(config);

  /**
   * Tests the connection to Node-RED
   * @returns {Promise<boolean>} True if connection is successful
   */
  async function testNodeRedConnection() {
    try {
      const headers = config.nodeRedToken ? { 'Authorization': 'Bearer ' + config.nodeRedToken } : {};
      await axios.get(config.nodeRedUrl, { headers, timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Starts the MCP server over stdio (default, for local/desktop clients).
   * @returns {Promise<void>}
   */
  async function startStdio() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  /**
   * Starts the MCP server over Streamable HTTP, so it can be fronted by a
   * reverse proxy / tunnel and consumed as a remote MCP server. Sessions are
   * tracked by the `mcp-session-id` header; each new session gets its own
   * server + transport pair (the standard @modelcontextprotocol/sdk pattern).
   * @returns {Promise<void>}
   */
  async function startHttp() {
    const app = express();
    app.use(express.json());

    // Map of active sessions: sessionId -> transport
    const transports = {};

    app.post(config.httpPath, async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      let transport;

      if (sessionId && transports[sessionId]) {
        // Reuse the transport for an existing session
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request -> spin up a fresh session
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports[sid] = transport;
          }
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };

        const sessionServer = createMcpServer(config);
        await sessionServer.connect(transport);
      } else {
        // No valid session and not an initialize request
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    });

    // GET (server-sent events) and DELETE (session teardown) share handling.
    const handleSessionRequest = async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }
      await transports[sessionId].handleRequest(req, res);
    };

    app.get(config.httpPath, handleSessionRequest);
    app.delete(config.httpPath, handleSessionRequest);

    await new Promise((resolve) => {
      app.listen(config.httpPort, '0.0.0.0', () => {
        if (config.verbose) {
          // eslint-disable-next-line no-console
          console.error(`node-red-mcp-server listening on http://0.0.0.0:${config.httpPort}${config.httpPath}`);
        }
        resolve();
      });
    });
  }

  /**
   * Starts the MCP server using the configured transport.
   * @returns {Promise<void>}
   */
  async function start() {
    // Test Node-RED connection but don't stop if it fails
    try {
      await testNodeRedConnection();
    } catch (_) {
      // Ignore errors
    }

    if (config.transportType === 'stdio') {
      await startStdio();
    } else if (config.transportType === 'http') {
      await startHttp();
    } else {
      throw new Error(`Unsupported transport type: ${config.transportType}`);
    }
  }

  return {
    server,
    config,
    start,
    testNodeRedConnection
  };
}

// If this file is run directly (not imported as a module)
if (import.meta.url.startsWith('file:') && import.meta.url === `file://${process.argv[1]}`) {
  try {
    const server = createServer();
    server.start();
  } catch (err) {
    process.exit(1);
  }
}

export { defaultConfig };
