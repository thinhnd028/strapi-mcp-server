# Strapi 5 MCP Server

A zero-dependency Model Context Protocol (MCP) server designed to help AI agents work efficiently with **Strapi 5** projects.

## Features

- **Schema Discovery**: Directly reads `src/api/*/content-types/*/schema.json` to provide AI with full context of your data structures.
- **REST API Integration**: Tools to query entries, handle population, and filters.
- **Zero Dependencies**: Runs natively with Node.js 18+ using standard `fetch` and `JSON-RPC`.

## Installation & Usage

Bạn có thể chạy trực tiếp từ GitHub bằng lệnh `npx` mà không cần clone code:

```bash
# Cách chạy trực tiếp
npx github:thinhnd028/strapi-mcp-server
```

## Configuration for Cursor / Claude Desktop

Để sử dụng ổn định, hãy thêm cấu hình sau vào MCP settings của bạn:

```json
{
  "mcpServers": {
    "strapi": {
      "command": "npx",
      "args": ["-y", "github:thinhnd028/strapi-mcp-server"],
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
