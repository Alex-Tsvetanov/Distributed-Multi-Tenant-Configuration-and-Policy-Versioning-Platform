const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const jwt = require('jsonwebtoken');

let mongoServer;
let apiProcess;
let apiUrl = 'http://localhost:3000';
const JWT_SECRET = 'cli-chaos-secret';

// Helpers from index.js
async function startSystem() {
    console.log(chalk.blue('Starting MongoDB Memory Server...'));
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    console.log(chalk.green(`MongoDB Memory Server started at: ${mongoUri}`));

    const env = {
        ...process.env,
        MONGODB_URI: mongoUri,
        PORT: 3000,
        JWT_SECRET: JWT_SECRET,
        RATE_LIMIT_MAX_REQUESTS: 50 // Lower for chaos triggers
    };

    apiProcess = spawn('node', [path.join(__dirname, '../src/app.js')], { env, stdio: 'pipe' });
    console.log(chalk.yellow('Waiting for API to be ready...'));
    for (let i = 0; i < 10; i++) {
        try { await axios.get(`${apiUrl}/health`); break; }
        catch (e) { await new Promise(r => setTimeout(r, 1000)); }
    }
}

function generateToken(tenantId = 'chaos-tenant', role = 'admin', secret = JWT_SECRET) {
    return jwt.sign({ id: 'chaos-bot', email: 'chaos@test.com', tenantId, role }, secret);
}

async function req(method, endpoint, data = null, token = null) {
    try {
        const config = { method, url: `${apiUrl}${endpoint}`, headers: {} };
        if (token) config.headers['Authorization'] = `Bearer ${token}`;
        if (data) { config.data = data; config.headers['Content-Type'] = 'application/json'; }
        const res = await axios(config);
        return { status: res.status, data: res.data };
    } catch (e) {
        return { status: e.response?.status || 500, data: e.response?.data || e.message };
    }
}

async function runChaos() {
    const token = generateToken();
    const badToken = generateToken('hacker-tenant', 'viewer', 'wrong-secret');
    let configId = 'none';

    const steps = [
        {
            name: 'Check Health (Neutral)',
            action: () => req('get', '/health')
        },
        {
            name: 'Deploy version 99 to ghost config (Illogical)',
            action: () => req('post', '/api/v1/configs/657fa338b874939d30e00000/deploy', { version: 99, environment: 'prod' }, token)
        },
        {
            name: 'List Tenants with invalid token (Security check)',
            action: () => req('get', '/api/v1/tenants', null, badToken)
        },
        {
            name: 'Register Chaos Tenant (Logical)',
            action: () => req('post', '/api/v1/tenants', { _id: 'chaos-tenant', name: 'Chaos Lab' }, token)
        },
        {
            name: 'Create a Config (Logical)',
            action: async () => {
                const res = await req('post', '/api/v1/tenants/chaos-tenant/configs', { name: 'chaos-app', environments: ['dev', 'prod'] }, token);
                configId = res.data?.data?._id;
                return res;
            }
        },
        {
            name: 'Rollback environment with ZERO deployments (Illogical)',
            action: () => req('post', `/api/v1/configs/${configId}/rollback`, { targetVersion: 1, environment: 'dev', reason: 'chaos' }, token)
        },
        {
            name: 'Create Version 1 (Logical)',
            action: () => req('post', `/api/v1/configs/${configId}/versions`, { data: { v: 1 }, changeLog: 'Start' }, token)
        },
        {
            name: 'Compare Version 1 with Version 999 (Illogical)',
            action: () => req('get', `/api/v1/configs/${configId}/compare?v1=1&v2=999`, null, token)
        },
        {
            name: 'Deploy Version 1 to "dev" (Logical)',
            action: () => req('post', `/api/v1/configs/${configId}/deploy`, { version: 1, environment: 'dev' }, token)
        },
        {
            name: 'Archive the Config (Logical/Orderly)',
            action: () => req('delete', `/api/v1/tenants/chaos-tenant/configs/${configId}`, null, token)
        },
        {
            name: 'Try to update an ARCHIVED config (Chaos)',
            action: () => req('put', `/api/v1/tenants/chaos-tenant/configs/${configId}`, { description: 'Resurrection' }, token)
        },
        {
            name: 'Rapid Fire 60 requests (Trigger Rate Limit)',
            action: async () => {
                const ps = [];
                for (let i = 0; i < 60; i++) ps.push(req('get', '/health'));
                const results = await Promise.all(ps);
                const limited = results.filter(r => r.status === 429).length;
                return { status: 429, data: { rateLimitedCount: limited } };
            }
        }
    ];

    console.log(chalk.magenta('\n--- STARTING CHAOS TEST SCRIPT ---'));

    for (const step of steps) {
        process.stdout.write(chalk.gray(`Running: ${step.name}... `));
        const res = await step.action();

        if (res.status >= 200 && res.status < 300) {
            console.log(chalk.green(`PASS (${res.status})`));
        } else if (res.status === 429 || res.status === 401 || res.status === 404 || res.status === 400) {
            console.log(chalk.yellow(`EXPECTED FAILURE (${res.status})`));
        } else {
            console.log(chalk.red(`UNEXPECTED ERROR (${res.status})`));
            console.log(res.data);
        }
        await new Promise(r => setTimeout(r, 300));
    }
}

(async () => {
    try {
        await startSystem();
        await runChaos();
    } catch (e) {
        console.error(e);
    } finally {
        if (apiProcess) apiProcess.kill();
        if (mongoServer) await mongoServer.stop();
        console.log(chalk.magenta('\n--- CHAOS TEST COMPLETED ---'));
        process.exit(0);
    }
})();
