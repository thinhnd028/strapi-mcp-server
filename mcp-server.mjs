#!/usr/bin/env node

/**
 * Strapi 5 MCP Server (Zero-Dependency Version) - UPGRADED
 * 
 * Provides tools to interact with Strapi 5 APIs, including schema discovery,
 * data querying, and content management (CRUD).
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
    STRAPI_URL: (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/$/, ''),
    STRAPI_TOKEN: process.env.STRAPI_TOKEN || '',
    PROJECT_ROOT: process.env.PROJECT_ROOT || (fs.existsSync(path.join(process.cwd(), 'backend')) ? path.join(process.cwd(), 'backend') : process.cwd()),
    LOG_FILE: 'mcp-server.log'
};

// --- Utils ---
function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    try {
        fs.appendFileSync(path.join(CONFIG.PROJECT_ROOT, CONFIG.LOG_FILE), line);
    } catch (e) {
        // Fallback if log file inaccessible
    }
    console.error(msg); // STDERR is used for logging in MCP
}

/**
 * Strapi 5 uses complex query objects. This helper converts nested objects
 * into the bracket notation that Strapi expects (e.g., filters[title][$eq]=val)
 */
function buildQueryString(params, prefix = '') {
    const parts = [];
    for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            const value = params[key];
            const newPrefix = prefix ? `${prefix}[${key}]` : key;

            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                parts.push(buildQueryString(value, newPrefix));
            } else if (Array.isArray(value)) {
                value.forEach((val, index) => {
                    if (typeof val === 'object') {
                        parts.push(buildQueryString(val, `${newPrefix}[${index}]`));
                    } else {
                        parts.push(`${encodeURIComponent(`${newPrefix}[${index}]`)}=${encodeURIComponent(val)}`);
                    }
                });
            } else if (value !== undefined) {
                parts.push(`${encodeURIComponent(newPrefix)}=${encodeURIComponent(value)}`);
            }
        }
    }
    return parts.filter(p => p !== '').join('&');
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

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { raw: text };
        }

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

function listContentTypes() {
    const apiDir = path.join(CONFIG.PROJECT_ROOT, 'src', 'api');
    if (!fs.existsSync(apiDir)) return { error: 'src/api directory not found' };

    const apis = fs.readdirSync(apiDir)
        .filter(name => fs.statSync(path.join(apiDir, name)).isDirectory());

    return { apis };
}

function getSchema(apiName) {
    const schemaPath = path.join(CONFIG.PROJECT_ROOT, 'src', 'api', apiName, 'content-types', apiName, 'schema.json');
    if (!fs.existsSync(schemaPath)) return { error: `Schema not found for ${apiName}` };

    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    return schema;
}

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

async function findEntries(pluralName, queryParams = {}) {
    const qs = buildQueryString(queryParams);
    return await strapiRequest(`/api/${pluralName}${qs ? `?${qs}` : ''}`);
}

// --- MCP Protocol Config ---

const TOOLS = [
    {
        name: 'strapi_whoami',
        description: 'Check connection and authentication status with Strapi.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'strapi_list_apis',
        description: 'List all custom Content Types (APIs) defined in the Strapi project (scans src/api).',
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
                    description: 'Query parameters in Strapi format (e.g., { populate: "*", filters: { title: { $contains: "key" } } })'
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
                populate: { type: 'string', description: 'Population string (e.g., "*")' }
            },
            required: ['pluralName', 'id']
        }
    },
    {
        name: 'strapi_create_entry',
        description: 'Create a new entry in a collection.',
        inputSchema: {
            type: 'object',
            properties: {
                pluralName: { type: 'string', description: 'The plural name' },
                data: { type: 'object', description: 'The data object to create' }
            },
            required: ['pluralName', 'data']
        }
    },
    {
        name: 'strapi_update_entry',
        description: 'Update an existing entry by ID.',
        inputSchema: {
            type: 'object',
            properties: {
                pluralName: { type: 'string', description: 'The plural name' },
                id: { type: 'string', description: 'The entry ID' },
                data: { type: 'object', description: 'The data object to update' }
            },
            required: ['pluralName', 'id', 'data']
        }
    },
    {
        name: 'strapi_delete_entry',
        description: 'Delete an entry by ID.',
        inputSchema: {
            type: 'object',
            properties: {
                pluralName: { type: 'string', description: 'The plural name' },
                id: { type: 'string', description: 'The entry ID' }
            },
            required: ['pluralName', 'id']
        }
    },
    {
        name: 'strapi_list_media',
        description: 'List files from the Strapi Media Library.',
        inputSchema: {
            type: 'object',
            properties: {
                queryParams: { type: 'object', description: 'Filters/pagination for media' }
            }
        }
    }
];

async function handleRequest(request) {
    const { method, params } = request;

    if (method === 'initialize') {
        return {
            protocolVersion: "2024-11-05",
            capabilities: {
                tools: { listChanged: false }
            },
            serverInfo: {
                name: "strapi-mcp-server-upgraded",
                version: "1.1.0"
            }
        };
    }

    if (method === 'notifications/initialized') return null;

    if (method === 'tools/list') {
        return { tools: TOOLS };
    }

    if (method === 'tools/call') {
        const { name, arguments: args } = params;
        try {
            let result;
            switch (name) {
                case 'strapi_whoami':
                    result = await strapiRequest('/api/users/me');
                    break;
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
                case 'strapi_create_entry':
                    result = await strapiRequest(`/api/${args.pluralName}`, 'POST', { data: args.data });
                    break;
                case 'strapi_update_entry':
                    result = await strapiRequest(`/api/${args.pluralName}/${args.id}`, 'PUT', { data: args.data });
                    break;
                case 'strapi_delete_entry':
                    result = await strapiRequest(`/api/${args.pluralName}/${args.id}`, 'DELETE');
                    break;
                case 'strapi_list_media':
                    const mqs = buildQueryString(args.queryParams || {});
                    result = await strapiRequest(`/api/upload/files${mqs ? `?${mqs}` : ''}`);
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
                process.stdout.write(JSON.stringify({
                    jsonrpc: '2.0',
                    id: request.id,
                    result
                }) + '\n');
            }
        } catch (error) {
            if (request.id !== undefined) {
                process.stdout.write(JSON.stringify({
                    jsonrpc: '2.0',
                    id: request.id,
                    error: { code: -32603, message: error.message }
                }) + '\n');
            }
        }
    } catch (e) {
        log(`Failed to parse request: ${e.message}`);
    }
});

log('Upgraded Strapi 5 MCP Server started');
