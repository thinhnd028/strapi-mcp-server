# Strapi 5 MCP Server

A zero-dependency Model Context Protocol (MCP) server designed to help AI agents work efficiently with **Strapi 5** projects.

## Features

- **Schema Discovery**: Directly reads `src/api/*/content-types/*/schema.json` to provide AI with full context of your data structures.
- **REST API Integration**: Tools to query entries, handle population, and filters.
- **Zero Dependencies**: Runs natively with Node.js 18+ using standard `fetch` and `JSON-RPC`.

## Installation

```bash
git clone <your-repo-url>
cd strapi-mcp-standalone
```

## Configuration

The server uses the following environment variables:

- `PROJECT_ROOT`: Path to your Strapi backend directory (required if not running inside the backend folder).
- `STRAPI_URL`: Your Strapi server URL (default: `http://localhost:1337`).
- `STRAPI_TOKEN`: Your Strapi API Token (Full Access or Custom).

## Usage in Cursor / VS Code MCP

Add the following to your MCP settings:

```json
{
  "mcpServers": {
    "strapi": {
      "command": "node",
      "args": ["/path/to/strapi-mcp-standalone/mcp-server.mjs"],
      "env": {
        "PROJECT_ROOT": "/path/to/your/strapi/backend",
        "STRAPI_URL": "http://localhost:1337",
        "STRAPI_TOKEN": "your_token"
      }
    }
  }
}
```

## Tools Available

- `strapi_list_apis`: List all Content Types.
- `strapi_get_schema`: Read internal schema definitions.
- `strapi_list_components`: List shared components.
- `strapi_query`: Query entries via REST API.
- `strapi_get_entry`: Get a specific entry by ID.
