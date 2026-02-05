#!/usr/bin/env node

/**
 * Strapi 5 MCP Server (Plugin Developer Edition)
 * Specialized for API interaction and Plugin Development (Design System + Plugin Structure).
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

function listComponents() {
    const compDir = path.join(CONFIG.PROJECT_ROOT, 'src', 'components');
    if (!fs.existsSync(compDir)) return { components: [] };
    const categories = fs.readdirSync(compDir).filter(name => fs.statSync(path.join(compDir, name)).isDirectory());
    const components = {};
    for (const cat of categories) {
        const catPath = path.join(compDir, cat);
        components[cat] = fs.readdirSync(catPath).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    }
    return { components };
}

async function findEntries(pluralName, queryParams = {}) {
    const qs = buildQueryString(queryParams);
    return await strapiRequest(`/api/${pluralName}${qs ? `?${qs}` : ''}`);
}

async function findPageBySlug(pluralName, slug) {
    const query = { filters: { slug: { $eq: slug } }, populate: 'deep' };
    const qs = buildQueryString(query);
    return await strapiRequest(`/api/${pluralName}?${qs}`);
}

async function replaceMediaUrls(oldBaseUrl, newBaseUrl) {
    let page = 1;
    let totalUpdated = 0;
    while (true) {
        const data = await strapiRequest(`/api/upload/files?pagination[page]=${page}&pagination[pageSize]=100`);
        const files = Array.isArray(data) ? data : (data.data || []);
        if (!files.length) break;
        for (const file of files) {
            if (file.url && file.url.includes(oldBaseUrl)) {
                const newUrl = file.url.replace(oldBaseUrl, newBaseUrl);
                await strapiRequest(`/api/upload/files/${file.id}?action=update`, 'POST', { fileInfo: { url: newUrl }, url: newUrl });
                totalUpdated++;
            }
        }
        if (files.length < 100) break;
        page++;
    }
    return { totalUpdated };
}

// --- Plugin Developer Tools ---

function listPlugins() {
    const pluginsDir = path.join(CONFIG.PROJECT_ROOT, 'src', 'plugins');
    if (!fs.existsSync(pluginsDir)) return { plugins: [], info: 'src/plugins directory not found' };
    const plugins = fs.readdirSync(pluginsDir).filter(name => fs.statSync(path.join(pluginsDir, name)).isDirectory());
    return { plugins };
}

function getPluginStructure(pluginName) {
    const pluginPath = path.join(CONFIG.PROJECT_ROOT, 'src', 'plugins', pluginName);
    if (!fs.existsSync(pluginPath)) return { error: `Plugin ${pluginName} not found` };

    const walk = (dir) => {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach((file) => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                if (file !== 'node_modules' && file !== '.git') {
                    results.push({ name: file, type: 'directory', children: walk(filePath) });
                }
            } else {
                results.push({ name: file, type: 'file' });
            }
        });
        return results;
    };
    return { name: pluginName, structure: walk(pluginPath) };
}

function listDesignSystem() {
    // Attempt to locate @strapi/design-system in node_modules
    const dsPath = path.join(CONFIG.PROJECT_ROOT, 'node_modules', '@strapi', 'design-system');
    if (!fs.existsSync(dsPath)) return { error: '@strapi/design-system not found in node_modules' };

    // Scan dist or main directory to find component names (simplified)
    const componentsDir = path.join(dsPath, 'dist'); // Usually components are here
    if (!fs.existsSync(componentsDir)) return { info: 'Design system found, but dist folder missing. Check package.json.' };

    // We can't easily list all components accurately without complex parsing, 
    // but we can provide a list of top-level folders/files which often match component names.
    const files = fs.readdirSync(componentsDir);
    return {
        message: 'Strapi Design System detected.',
        available_files: files.slice(0, 50), // Limit output
        tip: 'You can use components like Button, Box, Flex, Typography, etc., by importing from "@strapi/design-system".'
    };
}

// --- MCP Protocol Config ---

const TOOLS = [
    { name: 'strapi_whoami', description: 'Check connection.', inputSchema: { type: 'object', properties: {} } },
    { name: 'strapi_list_apis', description: 'List Content Types.', inputSchema: { type: 'object', properties: {} } },
    { name: 'strapi_get_schema', description: 'Get schema for API.', inputSchema: { type: 'object', properties: { apiName: { type: 'string' } }, required: ['apiName'] } },
    { name: 'strapi_list_components', description: 'List shared components.', inputSchema: { type: 'object', properties: {} } },
    { name: 'strapi_query', description: 'Advanced query.', inputSchema: { type: 'object', properties: { pluralName: { type: 'string' }, queryParams: { type: 'object' } }, required: ['pluralName'] } },
    { name: 'strapi_get_entry', description: 'Get entry by ID.', inputSchema: { type: 'object', properties: { pluralName: { type: 'string' }, id: { type: 'string' }, populate: { type: 'string' } }, required: ['pluralName', 'id'] } },
    { name: 'strapi_get_page_by_slug', description: 'Get entry by slug.', inputSchema: { type: 'object', properties: { pluralName: { type: 'string' }, slug: { type: 'string' } }, required: ['pluralName', 'slug'] } },
    { name: 'strapi_get_single', description: 'Get Single Type content.', inputSchema: { type: 'object', properties: { singularName: { type: 'string' }, populate: { type: 'string' } }, required: ['singularName'] } },
    { name: 'strapi_create_entry', description: 'Create entry.', inputSchema: { type: 'object', properties: { pluralName: { type: 'string' }, data: { type: 'object' } }, required: ['pluralName', 'data'] } },
    { name: 'strapi_update_entry', description: 'Update entry.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, id: { type: 'string' }, data: { type: 'object' } }, required: ['name', 'data'] } },
    { name: 'strapi_delete_entry', description: 'Delete entry.', inputSchema: { type: 'object', properties: { pluralName: { type: 'string' }, id: { type: 'string' } }, required: ['pluralName', 'id'] } },
    { name: 'strapi_list_media', description: 'List media.', inputSchema: { type: 'object', properties: { queryParams: { type: 'object' } } } },
    { name: 'strapi_replace_media_urls', description: 'Replace media URLs globally.', inputSchema: { type: 'object', properties: { oldBaseUrl: { type: 'string' }, newBaseUrl: { type: 'string' } }, required: ['oldBaseUrl', 'newBaseUrl'] } },

    // Developer Specific
    { name: 'strapi_list_plugins', description: 'List all custom plugins in src/plugins.', inputSchema: { type: 'object', properties: {} } },
    { name: 'strapi_get_plugin_structure', description: 'Explore the internal file structure of a plugin.', inputSchema: { type: 'object', properties: { pluginName: { type: 'string' } }, required: ['pluginName'] } },
    { name: 'strapi_get_design_system_info', description: 'Check for @strapi/design-system and list available modules.', inputSchema: { type: 'object', properties: {} } }
];

async function handleRequest(request) {
    const { method, params } = request;
    if (method === 'initialize') return { protocolVersion: "2024-11-05", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "strapi-mcp-dev-edition", version: "1.5.0" } };
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
                case 'strapi_list_components': result = listComponents(); break;
                case 'strapi_query': result = await findEntries(args.pluralName, args.queryParams); break;
                case 'strapi_get_entry': result = await strapiRequest(`/api/${args.pluralName}/${args.id}?populate=${args.populate || 'deep'}`); break;
                case 'strapi_get_page_by_slug': result = await findPageBySlug(args.pluralName, args.slug); break;
                case 'strapi_get_single': result = await strapiRequest(`/api/${args.singularName}?populate=${args.populate || 'deep'}`); break;
                case 'strapi_create_entry': result = await strapiRequest(`/api/${args.pluralName}`, 'POST', { data: args.data }); break;
                case 'strapi_update_entry':
                    const endpoint = args.id ? `/api/${args.name}/${args.id}` : `/api/${args.name}`;
                    result = await strapiRequest(endpoint, 'PUT', { data: args.data }); break;
                case 'strapi_delete_entry': result = await strapiRequest(`/api/${args.pluralName}/${args.id}`, 'DELETE'); break;
                case 'strapi_list_media': result = await strapiRequest(`/api/upload/files?${buildQueryString(args.queryParams || {})}`); break;
                case 'strapi_replace_media_urls': result = await replaceMediaUrls(args.oldBaseUrl, args.newBaseUrl); break;

                // Dev Tools
                case 'strapi_list_plugins': result = listPlugins(); break;
                case 'strapi_get_plugin_structure': result = getPluginStructure(args.pluginName); break;
                case 'strapi_get_design_system_info': result = listDesignSystem(); break;

                default: throw new Error(`Tool not found: ${name}`);
            }
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (e) { return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true }; }
    }
    throw new Error(`Method not found: ${method}`);
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
log('Plugin Developer Strapi MCP Server started');
