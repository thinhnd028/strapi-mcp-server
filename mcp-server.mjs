#!/usr/bin/env node

/**
 * Strapi 5 MCP Server (Zero-Dependency Version)
 * 
 * Provides tools to interact with Strapi 5 APIs, including schema discovery,
 * data querying, and content management.
 * 
 * Usage: 
 *   export STRAPI_URL=http://localhost:1337
 *   export STRAPI_TOKEN=your_token_here
 *   node mcp-server.mjs
 */

import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';

// --- Constants & Config ---
const CONFIG = {
    STRAPI_URL: process.env.STRAPI_URL || 'http://localhost:1337',
    STRAPI_TOKEN: process.env.STRAPI_TOKEN || '',
    PROJECT_ROOT: process.env.PROJECT_ROOT || (fs.existsSync(path.join(process.cwd(), 'backend')) ? path.join(process.cwd(), 'backend') : process.cwd()),
    LOG_FILE: 'mcp-server.log'
};

// --- Utils ---
function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    fs.appendFileSync(path.join(CONFIG.PROJECT_ROOT, CONFIG.LOG_FILE), line);
    console.error(msg); // STDERR is used for logging in MCP
}

async function strapiRequest(endpoint, method = 'GET', body = null) {
    const url = `${CONFIG.STRAPI_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
    };
    if (CONFIG.STRAPI_TOKEN) {
        headers['Authorization'] = `Bearer ${CONFIG.STRAPI_TOKEN}`;
    }

    log(`Request: ${method} ${url}`);
    try {
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Strapi API Error (${response.status}): ${JSON.stringify(data)}`);
        }
        return data;
    } catch (error) {
        log(`Error: ${error.message}`);
        throw error;
    }
}

// --- Tool Implementations ---

/**
 * Lists all available Content Types in the Strapi project by scanning src/api
 */
function listContentTypes() {
    const apiDir = path.join(CONFIG.PROJECT_ROOT, 'src', 'api');
    if (!fs.existsSync(apiDir)) return { error: 'src/api directory not found' };

    const apis = fs.readdirSync(apiDir)
        .filter(name => fs.statSync(path.join(apiDir, name)).isDirectory());

    return { apis };
}

/**
 * Gets the schema for a specific content type
 */
function getSchema(apiName) {
    const schemaPath = path.join(CONFIG.PROJECT_ROOT, 'src', 'api', apiName, 'content-types', apiName, 'schema.json');
    if (!fs.existsSync(schemaPath)) return { error: `Schema not found for ${apiName}` };

    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    return schema;
}

/**
 * Find entries with filters and pagination
 */
async function findEntries(pluralName, queryParams = {}) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
        if (typeof value === 'object') {
            // Handle nested objects (Strapi filters/populate)
            // Note: This is simplified. Strapi uses complex query formats.
            searchParams.append(key, JSON.stringify(value));
        } else {
            searchParams.append(key, value);
        }
    }

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return await strapiRequest(`/api/${pluralName}${queryString}`);
}

// --- JSON-RPC / MCP Protocol ---

const TOOLS = [
    {
        name: 'strapi_list_apis',
        description: 'List all custom Content Types (APIs) defined in the Strapi project.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'strapi_get_schema',
        description: 'Get the JSON schema definition for a specific content type.',
        inputSchema: {
            type: 'object',
            properties: {
                apiName: { type: 'string', description: 'The folder name in src/api (e.g., "news")' }
            },
            required: ['apiName']
        }
    },
    {
        name: 'strapi_list_components',
        description: 'List all shared components in the Strapi project (src/components).',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'strapi_query',
        description: 'Query Strapi REST API for entries. Supports filters, sorting, and pagination.',
        inputSchema: {
            type: 'object',
            properties: {
                pluralName: { type: 'string', description: 'The plural name (e.g., "news", "articles")' },
                queryParams: {
                    type: 'object',
                    description: 'Query parameters. Use Strapi 5 format (e.g., { "populate": "*", "filters": { "title": { "$contains": "keyword" } } })'
                }
            },
            required: ['pluralName']
        }
    },
    {
        name: 'strapi_get_entry',
        description: 'Get a specific entry by ID.',
        inputSchema: {
            type: 'object',
            properties: {
                pluralName: { type: 'string', description: 'The plural name' },
                id: { type: 'string', description: 'The document ID or entry ID' },
                populate: { type: 'string', description: 'Population string (e.g., "*", "deep")' }
            },
            required: ['pluralName', 'id']
        }
    }
];

function listComponents() {
    const compDir = path.join(CONFIG.PROJECT_ROOT, 'src', 'components');
    if (!fs.existsSync(compDir)) return { components: [] };

    const categories = fs.readdirSync(compDir)
        .filter(name => fs.statSync(path.join(compDir, name)).isDirectory());

    const components = {};
    for (const cat of categories) {
        const catPath = path.join(compDir, cat);
        components[cat] = fs.readdirSync(catPath)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
    }
    return { components };
}

async function handleRequest(request) {
    const { method, params, id } = request;

    // 1. Xử lý lệnh bắt tay khởi tạo (CỰC KỲ QUAN TRỌNG)
    if (method === 'initialize') {
        return {
            protocolVersion: "2024-11-05",
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: "strapi-mcp-server",
                version: "1.0.0"
            }
        };
    }

    if (method === 'notifications/initialized') {
        return null; // Không cần phản hồi cho thông báo
    }

    if (method === 'listTools') {
        return { tools: TOOLS };
    }

    if (method === 'callTool') {
        const { name, arguments: args } = params;
        try {
            let result;
            switch (name) {
                case 'strapi_list_apis':
                    result = listContentTypes();
                    break;
                case 'strapi_get_schema':
                    result = getSchema(args.apiName);
                    break;
                case 'strapi_list_components':
                    result = listComponents();
                    break;
                case 'strapi_query':
                    result = await findEntries(args.pluralName, args.queryParams);
                    break;
                case 'strapi_get_entry':
                    const qs = args.populate ? `?populate=${args.populate}` : '';
                    result = await strapiRequest(`/api/${args.pluralName}/${args.id}${qs}`);
                    break;
                default:
                    throw new Error(`Tool not found: ${name}`);
            }
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error: ${e.message}` }],
                isError: true
            };
        }
    }

    throw new Error(`Method not found: ${method}`);
}

// --- Main Loop ---
const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
        const request = JSON.parse(line);
        try {
            const result = await handleRequest(request);
            if (request.id !== undefined) {
                console.log(JSON.stringify({
                    jsonrpc: '2.0',
                    id: request.id,
                    result
                }));
            }
        } catch (error) {
            if (request.id !== undefined) {
                console.log(JSON.stringify({
                    jsonrpc: '2.0',
                    id: request.id,
                    error: { code: -32601, message: error.message }
                }));
            }
        }
    } catch (e) {
        log(`Failed to parse request: ${e.message}`);
    }
});

log('Strapi 5 MCP Server started');
