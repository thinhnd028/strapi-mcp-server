#!/usr/bin/env node

/**
 * Strapi 5 MCP Server (Ultra Edition)
 * Optimized for Landing Page & Multi-page CMS projects
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
    } catch (e) { }
    console.error(msg);
}

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
    const headers = { 'Content-Type': 'application/json' };
    if (CONFIG.STRAPI_TOKEN) headers['Authorization'] = `Bearer ${CONFIG.STRAPI_TOKEN}`;

    log(`Request: ${method} ${url}`);
    try {
        const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
        if (!response.ok) throw new Error(`Strapi API Error (${response.status}): ${JSON.stringify(data)}`);
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
    const apis = fs.readdirSync(apiDir).filter(name => fs.statSync(path.join(apiDir, name)).isDirectory());
    return { apis };
}

function getSchema(apiName) {
    const schemaPath = path.join(CONFIG.PROJECT_ROOT, 'src', 'api', apiName, 'content-types', apiName, 'schema.json');
    if (!fs.existsSync(schemaPath)) return { error: `Schema not found for ${apiName}` };
    return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

async function findPageBySlug(pluralName, slug) {
    const query = { filters: { slug: { $eq: slug } }, populate: 'deep' };
    const qs = buildQueryString(query);
    return await strapiRequest(`/api/${pluralName}?${qs}`);
}

async function getGlobalSettings() {
    // Thường là các Single Types như 'global' hoặc 'setting'
    try {
        return await strapiRequest('/api/global?populate=deep');
    } catch (e) {
        return { error: "Global settings not found or endpoint not /api/global" };
    }
}

// --- MCP Protocol Config ---

const TOOLS = [
    {
        name: 'strapi_whoami',
        description: 'Check connection and auth status.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'strapi_list_apis',
        description: 'List all APIs (Content Types). Useful to see available pages/collections.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'strapi_get_schema',
        description: 'Get schema for a Content Type (field names, types, components).',
        inputSchema: {
            type: 'object',
            properties: { apiName: { type: 'string' } },
            required: ['apiName']
        }
    },
    {
        name: 'strapi_get_page_by_slug',
        description: 'Fetch a page by its slug (common for landing pages). Autopopulates deep.',
        inputSchema: {
            type: 'object',
            properties: {
                pluralName: { type: 'string', description: 'e.g. "pages", "landing-pages"' },
                slug: { type: 'string' }
            },
            required: ['pluralName', 'slug']
        }
    },
    {
        name: 'strapi_get_global',
        description: 'Fetch global settings (SEO, Header, Footer) from /api/global.',
        inputSchema: { type: 'object', properties: {} }
    },
    {
        name: 'strapi_query',
        description: 'Advanced query with filters, populate, sort.',
        inputSchema: {
            type: 'object',
            properties: {
                pluralName: { type: 'string' },
                queryParams: { type: 'object' }
            },
            required: ['pluralName']
        }
    },
    {
        name: 'strapi_create_entry',
        description: 'Create new entry.',
        inputSchema: {
            type: 'object',
            properties: { pluralName: { type: 'string' }, data: { type: 'object' } },
            required: ['pluralName', 'data']
        }
    },
    {
        name: 'strapi_update_entry',
        description: 'Update entry.',
        inputSchema: {
            type: 'object',
            properties: { pluralName: { type: 'string' }, id: { type: 'string' }, data: { type: 'object' } },
            required: ['pluralName', 'id', 'data']
        }
    },
    {
        name: 'strapi_list_media',
        description: 'Browse images/assets in Media Library.',
        inputSchema: {
            type: 'object',
            properties: { queryParams: { type: 'object' } }
        }
    }
];

async function handleRequest(request) {
    const { method, params } = request;

    if (method === 'initialize') {
        return {
            protocolVersion: "2024-11-05",
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "strapi-mcp-ultra", version: "1.2.0" }
        };
    }
    if (method === 'notifications/initialized') return null;
    if (method === 'tools/list') return { tools: TOOLS };

    if (method === 'tools/call') {
        const { name, arguments: args } = params;
        try {
            let result;
            switch (name) {
                case 'strapi_whoami': result = await strapiRequest('/api/users/me'); break;
                case 'strapi_list_apis': result = listContentTypes(); break;
                case 'strapi_get_schema': result = getSchema(args.apiName); break;
                case 'strapi_get_page_by_slug': result = await findPageBySlug(args.pluralName, args.slug); break;
                case 'strapi_get_global': result = await getGlobalSettings(); break;
                case 'strapi_query': result = await findEntries(args.pluralName, args.queryParams); break;
                case 'strapi_create_entry': result = await strapiRequest(`/api/${args.pluralName}`, 'POST', { data: args.data }); break;
                case 'strapi_update_entry': result = await strapiRequest(`/api/${args.pluralName}/${args.id}`, 'PUT', { data: args.data }); break;
                case 'strapi_list_media':
                    const mqs = buildQueryString(args.queryParams || {});
                    result = await strapiRequest(`/api/upload/files${mqs ? `?${mqs}` : ''}`);
                    break;
                default: throw new Error(`Tool not found: ${name}`);
            }
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (e) {
            return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
        }
    }
    throw new Error(`Method not found: ${method}`);
}

async function findEntries(pluralName, queryParams = {}) {
    const qs = buildQueryString(queryParams);
    return await strapiRequest(`/api/${pluralName}${qs ? `?${qs}` : ''}`);
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
        const request = JSON.parse(line);
        try {
            const result = await handleRequest(request);
            if (request.id !== undefined) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
        } catch (error) {
            if (request.id !== undefined) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32603, message: error.message } }) + '\n');
        }
    } catch (e) { log(`Failed to parse request: ${e.message}`); }
});

log('Ultra Strapi MCP Server for Landing Pages started');
