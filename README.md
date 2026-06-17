[![npm version](https://img.shields.io/npm/v/node-red-mcp-server.svg)](https://www.npmjs.com/package/node-red-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/node-red-mcp-server.svg)](https://www.npmjs.com/package/node-red-mcp-server)
[![GitHub license](https://img.shields.io/github/license/karavaev-evgeniy/node-red-mcp-server.svg)](https://github.com/karavaev-evgeniy/node-red-mcp-server/blob/main/LICENSE)

# node-red-mcp-server

Model Context Protocol (MCP) server for Node-RED — allows language models (like Claude, GPT) to interact with Node-RED through a standardized API.

## Description

`node-red-mcp-server` creates a bridge between language models and the Node-RED platform, providing tools to manage flows, nodes, and settings via the MCP (Model Context Protocol). This enables language models to automate and control Node-RED flows programmatically.

### Key Features

- Retrieve and update Node-RED flows via MCP
- Manage tabs and individual nodes
- Search for nodes by type or properties
- Access settings and runtime state
- Trigger inject nodes remotely
- Output and visualize flows and stats

## Installation

### Global Installation

```bash
npm install -g node-red-mcp-server
```

### Local Installation

```bash
npm install node-red-mcp-server
```

## Usage

### Command Line

```bash
node-red-mcp-server --url http://localhost:1880 --token YOUR_TOKEN
```

### Remote (Streamable HTTP) mode

By default the server speaks MCP over **stdio**, which is what local desktop clients use.
To run it as a long-lived **remote** MCP server (for example behind a reverse proxy or
tunnel), start it with the `--http` flag, which exposes a Streamable HTTP endpoint at `/mcp`:

```bash
node-red-mcp-server --http 3000 --url http://localhost:1880 --token YOUR_TOKEN
```

The endpoint is then available at `http://localhost:3000/mcp`. HTTP mode can also be selected
with environment variables (`MCP_TRANSPORT=http` and/or `MCP_HTTP_PORT=3000`), which is how
the bundled `Dockerfile` runs it:

```bash
docker build -t node-red-mcp .
docker run -p 3000:3000 -e NODE_RED_URL=http://host.docker.internal:1880 node-red-mcp
```

> Note: HTTP mode does **not** add authentication of its own. Put it behind an
> authenticating reverse proxy / tunnel (e.g. Cloudflare Access) if you expose it publicly.

### Configuration via `.env`

Create a `.env` file:

```
NODE_RED_URL=http://localhost:1880
NODE_RED_TOKEN=YOUR_TOKEN
```

Then run:

```bash
node-red-mcp-server
```

### Integration with Claude or Other LLMs

1. Start the MCP server or configure Claude Desktop to start it automatically with the tool configuration below.

2. Configure Claude Desktop:
   - Open Claude Desktop app
   - Go to Settings → Advanced → Tool Configuration
   - Add a new tool configuration. You can use `npx` to run the server without manual installation. This is often the easiest way to get started:

   ```json
   {
     "node-red": {
       "command": "npx",
       "args": [
         "node-red-mcp-server"
       ],
       "env": {
         "NODE_RED_URL": "http://your-node-red-url:1880",
         "NODE_RED_TOKEN": "your-token-if-needed"
       }
     }
   }
   ```
   - Ensure `NODE_RED_URL` points to your Node-RED instance.
   - Set `NODE_RED_TOKEN` if your Node-RED instance requires authentication.

   Alternatively, if you have installed the server globally or locally and know the path to the script, you can configure it like this:
   ```json
   {
     "node-red": {
       "command": "node",
       "args": [
         "/path/to/node-red-mcp-server/bin/node-red-mcp-server.mjs"
         // You can add other CLI arguments here, e.g., "--verbose"
       ],
       "env": {
         "NODE_RED_URL": "http://your-node-red-url:1880",
         "NODE_RED_TOKEN": "your-token-if-needed",
         "MCP_SERVER_PORT": "3000"
       }
     }
   }
   ```
   - Replace `/path/to/node-red-mcp-server` with the actual path to your installation
   - Update `NODE_RED_URL` to point to your Node-RED instance
   - Set `NODE_RED_TOKEN` if your Node-RED instance requires authentication

3. After configuration, Claude can interact with your Node-RED instance through the MCP tools.

For more information about the Model Context Protocol, visit the [official MCP documentation](https://modelcontextprotocol.io/introduction).

### Programmatic Usage

```javascript
import { createServer } from 'node-red-mcp-server';

const server = createServer({
  nodeRedUrl: 'http://localhost:1880',
  nodeRedToken: 'YOUR_TOKEN',
  verbose: true
});

await server.start();
```

## Configuration Options

### CLI Parameters

| Parameter       | Short | Description                          |
|----------------|-------|--------------------------------------|
| `--url`        | `-u`  | Node-RED base URL                    |
| `--token`      | `-t`  | API access token                     |
| `--http`       |       | Run in Streamable HTTP mode on the given port (default `3000`) instead of stdio |
| `--verbose`    | `-v`  | Enable verbose logging               |
| `--help`       | `-h`  | Show help                            |
| `--version`    | `-V`  | Show version number                  |

### Environment Variables

| Variable         | Description                    |
|------------------|--------------------------------|
| `NODE_RED_URL`   | URL of your Node-RED instance |
| `NODE_RED_TOKEN` | API access token              |
| `MCP_TRANSPORT`  | Set to `http` to run in Streamable HTTP mode (default `stdio`) |
| `MCP_HTTP_PORT`  | Port for HTTP mode (default `3000`; setting it implies HTTP mode) |

## MCP Tools

### Flow Tools

- `get-flows` — Get all flows
- `update-flows` — Update all flows
- `get-flow` — Get a specific flow by ID
- `update-flow` — Update a specific flow by ID
- `list-tabs` — List all tabs (workspaces)
- `create-flow` — Create a new flow tab
- `delete-flow` — Delete a flow tab
- `get-flows-state` — Get deployment state
- `set-flows-state` — Change deployment state
- `get-flows-formatted` — Get human-readable flow list
- `visualize-flows` — Generate graph-like view of flows

### Node Tools

- `inject` — Trigger an inject node
- `get-nodes` — List available node types
- `get-node-info` — Detailed info about a node module
- `toggle-node-module` — Enable/disable a node module
- `find-nodes-by-type` — Locate nodes by type
- `search-nodes` — Find nodes by name or property

### Settings Tools

- `get-settings` — Get Node-RED runtime settings
- `get-diagnostics` — Fetch diagnostics info

### Utility Tools

- `api-help` — Show Node-RED API help

## Requirements

- Node.js v18 or newer
- A running Node-RED instance with HTTP API access

## License

MIT License

Copyright (c) 2023

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
