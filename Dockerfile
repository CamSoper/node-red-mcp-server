# Container image for node-red-mcp-server in Streamable HTTP mode.
# Built/published by .github/workflows/docker-publish.yml and consumed by
# CamSoper/home-lab-iac (ContainerConfigs/Server/NodeRedMcp.cs), where it runs
# on the docker "mcp" network behind the cloudflared tunnel connector.
FROM node:20-alpine

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package.json ./
RUN npm install --omit=dev --no-package-lock

# Application source
COPY bin ./bin
COPY lib ./lib

# Run as the unprivileged user that ships with the node image.
USER node

ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    MCP_HTTP_PORT=3000

EXPOSE 3000

# --http <port> selects the Streamable HTTP transport (endpoint: /mcp).
CMD ["node", "bin/node-red-mcp-server.mjs", "--http", "3000"]
