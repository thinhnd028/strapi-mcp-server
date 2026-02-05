# 🚀 Strapi 5 MCP Server (God Mode)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Strapi Version](https://img.shields.io/badge/Strapi-v5-blueviolet.svg)](https://strapi.io/)
[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol-blue.svg)](https://modelcontextprotocol.io/)

A zero-dependency **Model Context Protocol (MCP)** server tailored for **Strapi 5**. This server empowers AI agents (like Cursor, Claude Desktop, or custom LLM apps) with "God Mode" access to your Strapi CMS—enabling them to understand your schema, query content with deep population, manage media, and even explore plugin architectures.

---

## ✨ Features

- 🔍 **Deep Schema Discovery**: Directly reads your local `src/api/*/content-types/*/schema.json` to give AI full context of your data structures.
- 🛠️ **Full CRUD Operations**: Create, Read, Update, and Delete entries across Collection and Single Types.
- 🌊 **Deep Population**: Built-in support for `populate=deep` and complex API queries.
- 🖼️ **Media Intelligence**: List media files and even globally replace media URLs (perfect for migrations or staging syncs).
- 🧩 **Developer Toolbox**: Explore custom plugins and discover available components in the Strapi Design System.
- ⚡ **Zero Dependencies**: Lightweight and fast. Runs natively with Node.js 18+ using standard `fetch`.

---

## 🚀 Quick Start

You can run the server directly from GitHub without cloning the code:

```bash
npx -y github:thinhnd028/strapi-mcp-server
```

---

## ⚙️ Configuration

The server requires the following environment variables to function correctly:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PROJECT_ROOT` | Path to your Strapi backend folder (where `src/` lives). | Current working directory |
| `STRAPI_URL` | The base URL of your Strapi instance. | `http://localhost:1337` |
| `STRAPI_TOKEN` | A Full Access API Token (needed for CRUD ops). | (Optional if API is public) |

### Integration with Cursor / Claude Desktop

Add this to your MCP settings (`claude_desktop_config.json` or Cursor MCP settings):

```json
{
  "mcpServers": {
    "strapi": {
      "command": "npx",
      "args": ["-y", "github:thinhnd028/strapi-mcp-server"],
      "env": {
        "PROJECT_ROOT": "/Users/yourname/projects/my-strapi-app",
        "STRAPI_URL": "http://localhost:1337",
        "STRAPI_TOKEN": "your_long_api_token_here"
      }
    }
  }
}
```

---

## 🧰 Available Tools

### 📦 Content Management
- `strapi_list_apis`: List all available Content Types.
- `strapi_get_schema`: Retrieve the internal JSON schema for a specific API.
- `strapi_list_components`: List shared components available in the project.
- `strapi_query`: Perform complex queries with filters and pagination.
- `strapi_get_entry`: Fetch a specific entry by ID (with deep auto-population).
- `strapi_get_page_by_slug`: Find entries by slug (ideal for frontend developers).
- `strapi_get_single`: Fetch content from Single Types.
- `strapi_create_entry`: Create a new entry.
- `strapi_update_entry`: Update an existing entry.
- `strapi_delete_entry`: Delete an entry.

### 🖼️ Media & Assets
- `strapi_list_media`: List and filter media library assets.
- `strapi_replace_media_urls`: Bulk replace media URLs (useful for staging -> production sync).

### 🛠️ Developer Essentials
- `strapi_list_plugins`: Discover custom plugins in `src/plugins`.
- `strapi_get_plugin_structure`: Map out the file structure of a specific plugin.
- `strapi_get_design_system_info`: List available modules in `@strapi/design-system`.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Developed with ❤️ for the Strapi Community.
