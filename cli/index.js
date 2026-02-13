const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const inquirer = require('inquirer');
const chalk = require('chalk');
const jwt = require('jsonwebtoken');

let mongoServer;
let apiProcess;
let apiUrl = 'http://localhost:3000';
const JWT_SECRET = 'cli-test-secret';

async function startSystem() {
    console.log(chalk.blue('Starting MongoDB Memory Server...'));
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    console.log(chalk.green(`MongoDB Memory Server started at: ${mongoUri}`));

    console.log(chalk.blue('Starting API Server in background...'));

    // Set environment variables for the child process
    const env = {
        ...process.env,
        MONGODB_URI: mongoUri,
        NODE_ENV: 'test',
        PORT: 3000,
        JWT_SECRET: JWT_SECRET,
        RATE_LIMIT_MAX_REQUESTS: 100 // Lowering for easier testing of rate limits
    };

    apiProcess = spawn('node', [path.join(__dirname, '../src/app.js')], {
        env,
        stdio: 'pipe'
    });

    apiProcess.stdout.on('data', (data) => {
        // Uncomment to see API logs
        // console.log(chalk.gray(`[API] ${data}`));
    });

    apiProcess.stderr.on('data', (data) => {
        console.error(chalk.red(`[API Error] ${data}`));
    });

    // Wait for API to be ready
    console.log(chalk.yellow('Waiting for API to be ready...'));
    let retries = 10;
    while (retries > 0) {
        try {
            await axios.get(`${apiUrl}/health`);
            console.log(chalk.green('API is ready!'));
            break;
        } catch (e) {
            retries--;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    if (retries === 0) {
        console.error(chalk.red('Failed to connect to API server.'));
        process.exit(1);
    }
}

async function stopSystem() {
    console.log(chalk.blue('\nShutting down...'));
    if (apiProcess) apiProcess.kill();
    if (mongoServer) await mongoServer.stop();
    console.log(chalk.green('System stopped.'));
}

function generateToken(tenantId = 'default-tenant', role = 'admin') {
    return jwt.sign(
        { id: 'cli-user', email: 'cli@test.com', tenantId, role },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

async function performRequest(method, endpoint, data = null, token = null) {
    try {
        const config = {
            method,
            url: `${apiUrl}${endpoint}`,
            headers: {}
        };

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        if (data && Object.keys(data).length > 0) {
            config.data = data;
            config.headers['Content-Type'] = 'application/json';
        }

        const response = await axios(config);
        return response;
    } catch (error) {
        if (error.response) {
            return error.response;
        }
        throw error;
    }
}

async function stressTest(type, token) {
    const count = type === 'burst' ? 50 : 150;
    console.log(chalk.magenta(`\nRunning stress test: ${type} with ${count} parallel requests...`));

    const promises = [];
    const startTime = Date.now();

    for (let i = 0; i < count; i++) {
        promises.push(performRequest('get', '/health', null, token));
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    const success = results.filter(r => r.status === 200).length;
    const rateLimited = results.filter(r => r.status === 429).length;
    const errors = results.filter(r => r.status !== 200 && r.status !== 429).length;

    console.log(chalk.cyan(`Results:`));
    console.log(`- Total time: ${endTime - startTime}ms`);
    console.log(`- Successes (200): ${chalk.green(success)}`);
    console.log(`- Rate Limited (429): ${chalk.yellow(rateLimited)}`);
    if (errors > 0) console.log(`- Other Errors: ${chalk.red(errors)}`);
}

async function mainLoop() {
    let exit = false;
    let selectedTenantId = 'cli-tenant-1';
    let token = generateToken(selectedTenantId);

    console.log(chalk.green(`\nStarting session with Tenant: ${selectedTenantId}`));

    while (!exit) {
        const { choice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'choice',
                message: 'Select action:',
                choices: [
                    'Health Status',
                    'Create/Update Tenant',
                    'List All Tenants',
                    new inquirer.Separator('Configs'),
                    'Create Config',
                    'List Configs',
                    'Update Config',
                    'Archive Config',
                    new inquirer.Separator('Versions & Operations'),
                    'Create Version',
                    'List Versions',
                    'Deploy Version',
                    'Rollback Environment',
                    'Compare Versions',
                    new inquirer.Separator('Automation'),
                    'Seed Test Data',
                    new inquirer.Separator('Stress Testing'),
                    'Stress Test: Normal Usage (Positive)',
                    'Stress Test: Rate Limit Breach (Negative)',
                    new inquirer.Separator('Settings'),
                    'Change Current Tenant ID',
                    'Exit'
                ]
            }
        ]);

        switch (choice) {
            case 'Health Status':
                const health = await performRequest('get', '/health');
                console.log(JSON.stringify(health.data, null, 2));
                break;

            case 'Seed Test Data':
                console.log(chalk.blue('\n--- Seeding Process Started ---'));
                // 1. Create Tenant
                console.log(chalk.gray('1. Creating Tenant...'));
                await performRequest('post', '/api/v1/tenants', {
                    _id: selectedTenantId,
                    name: 'Seed Tenant',
                    description: 'Automatically Seeded'
                }, token);

                // 2. Create Config
                console.log(chalk.gray('2. Creating Configuration...'));
                const seedC = await performRequest('post', `/api/v1/tenants/${selectedTenantId}/configs`, {
                    name: `seeded-config-${Date.now().toString().slice(-4)}`,
                    description: 'Auto-seeded',
                    environments: ['dev', 'test', 'staging', 'prod']
                }, token);

                if (seedC.status !== 201) {
                    console.error(chalk.red('Failed to create config during seed'));
                    break;
                }
                const seedId = seedC.data.data._id;

                // 3. Create Version
                console.log(chalk.gray('3. Creating Version 1...'));
                await performRequest('post', `/api/v1/configs/${seedId}/versions`, {
                    data: { api_timeout: 3000, debug: true, theme: 'dark' },
                    changeLog: 'Initial seeded version'
                }, token);

                // 4. Deploy to Dev
                console.log(chalk.gray('4. Deploying to Dev...'));
                const deployRes = await performRequest('post', `/api/v1/configs/${seedId}/deploy`, {
                    version: 1,
                    environment: 'dev'
                }, token);

                if (deployRes.status === 200) {
                    console.log(chalk.green('✔ Seeding successful!'));
                    console.log(`Config ID: ${chalk.yellow(seedId)}`);
                    console.log(`Version 1 is now ${chalk.green('LIVE')} on 'dev'`);
                } else {
                    console.log(chalk.red('⚠ Seeding completed with deployment errors.'));
                }
                break;

            case 'Create/Update Tenant':
                const tData = await inquirer.prompt([
                    { name: '_id', message: 'Tenant ID:', default: selectedTenantId },
                    { name: 'name', message: 'Tenant Name:', default: `Tenant ${selectedTenantId}` },
                    { name: 'description', message: 'Description:', default: 'Interactive CLI Tenant' }
                ]);
                const tRes = await performRequest('post', '/api/v1/tenants', tData, token);
                console.log(chalk.cyan('Status:'), tRes.status);
                console.log(tRes.data);
                break;

            case 'List All Tenants':
                const ltRes = await performRequest('get', '/api/v1/tenants', null, token);
                console.log(chalk.cyan('Status:'), ltRes.status);
                if (ltRes.data.success) console.table(ltRes.data.data);
                else console.log(ltRes.data);
                break;

            case 'Create Config':
                const cData = await inquirer.prompt([
                    { name: 'name', message: 'Config Name:', default: `config-${Date.now().toString().slice(-6)}` },
                    { name: 'description', message: 'Description:', default: 'CLI Created Config' },
                    {
                        type: 'checkbox',
                        name: 'environments',
                        message: 'Environments:',
                        choices: ['dev', 'test', 'staging', 'prod'],
                        default: ['dev', 'test']
                    }
                ]);
                const cRes = await performRequest('post', `/api/v1/tenants/${selectedTenantId}/configs`, cData, token);
                console.log(chalk.cyan('Status:'), cRes.status);
                console.log(cRes.data);
                break;

            case 'List Configs':
                const lcRes = await performRequest('get', `/api/v1/tenants/${selectedTenantId}/configs`, null, token);
                console.log(chalk.cyan('Status:'), lcRes.status);
                if (lcRes.data.success) {
                    console.table(lcRes.data.data.map(c => ({ id: c._id, name: c.name, archived: c.isArchived })));
                } else console.log(lcRes.data);
                break;

            case 'Update Config':
                const { configId: uId } = await inquirer.prompt([{ name: 'configId', message: 'Enter Config Mongo ID:' }]);
                const uData = await inquirer.prompt([
                    { name: 'description', message: 'New Description:' },
                    { type: 'checkbox', name: 'environments', message: 'Environments:', choices: ['dev', 'test', 'staging', 'prod'] }
                ]);
                const uRes = await performRequest('put', `/api/v1/tenants/${selectedTenantId}/configs/${uId}`, uData, token);
                console.log(chalk.cyan('Status:'), uRes.status);
                console.log(uRes.data);
                break;

            case 'Archive Config':
                const { configId: aId } = await inquirer.prompt([{ name: 'configId', message: 'Enter Config Mongo ID:' }]);
                const aRes = await performRequest('delete', `/api/v1/tenants/${selectedTenantId}/configs/${aId}`, null, token);
                console.log(chalk.cyan('Status:'), aRes.status);
                console.log(aRes.data);
                break;

            case 'Create Version':
                const { configId: vCId } = await inquirer.prompt([{ name: 'configId', message: 'Enter Config Mongo ID:' }]);
                const vDataInput = await inquirer.prompt([
                    { name: 'dataJson', message: 'Data (JSON string):', default: '{"feature": true, "timeout": 5000}' },
                    { name: 'changeLog', message: 'Change Log:', default: 'Manual version from CLI' }
                ]);
                try {
                    const vRes = await performRequest('post', `/api/v1/configs/${vCId}/versions`, {
                        data: JSON.parse(vDataInput.dataJson),
                        changeLog: vDataInput.changeLog
                    }, token);
                    console.log(chalk.cyan('Status:'), vRes.status);
                    console.log(vRes.data);
                } catch (e) {
                    console.error(chalk.red('Invalid JSON or request failed'));
                }
                break;

            case 'List Versions':
                const { configId: lvCId } = await inquirer.prompt([{ name: 'configId', message: 'Enter Config Mongo ID:' }]);
                const lvRes = await performRequest('get', `/api/v1/configs/${lvCId}/versions`, null, token);
                process.stdout.write(chalk.cyan('Status: ') + lvRes.status + '\n');
                if (lvRes.data.success) console.table(lvRes.data.data.map(v => ({ v: v.version, branch: v.branch, log: v.changeLog })));
                else console.log(lvRes.data);
                break;

            case 'Deploy Version':
                const { configId: dCId } = await inquirer.prompt([{ name: 'configId', message: 'Enter Config Mongo ID:' }]);
                const dData = await inquirer.prompt([
                    { name: 'version', type: 'number', message: 'Version Number:' },
                    { name: 'environment', type: 'list', choices: ['dev', 'test', 'staging', 'prod'] }
                ]);
                const dRes = await performRequest('post', `/api/v1/configs/${dCId}/deploy`, dData, token);
                console.log(chalk.cyan('Status:'), dRes.status);
                console.log(dRes.data);
                break;

            case 'Rollback Environment':
                const { configId: rCId } = await inquirer.prompt([{ name: 'configId', message: 'Enter Config Mongo ID:' }]);
                const rData = await inquirer.prompt([
                    { name: 'targetVersion', type: 'number', message: 'Target Version Number:' },
                    { name: 'environment', type: 'list', choices: ['dev', 'test', 'staging', 'prod'] },
                    { name: 'reason', message: 'Reason:' }
                ]);
                const rRes = await performRequest('post', `/api/v1/configs/${rCId}/rollback`, rData, token);
                console.log(chalk.cyan('Status:'), rRes.status);
                console.log(rRes.data);
                break;

            case 'Compare Versions':
                const { configId: cpCId } = await inquirer.prompt([{ name: 'configId', message: 'Enter Config Mongo ID:' }]);
                const { v1, v2 } = await inquirer.prompt([
                    { name: 'v1', type: 'number', message: 'Version 1:' },
                    { name: 'v2', type: 'number', message: 'Version 2:' }
                ]);
                const cpRes = await performRequest('get', `/api/v1/configs/${cpCId}/compare?v1=${v1}&v2=${v2}`, null, token);
                console.log(chalk.cyan('Status:'), cpRes.status);
                console.log(JSON.stringify(cpRes.data, null, 2));
                break;

            case 'Stress Test: Normal Usage (Positive)':
                await stressTest('burst', token);
                break;

            case 'Stress Test: Rate Limit Breach (Negative)':
                await stressTest('rate-limit', token);
                break;

            case 'Change Current Tenant ID':
                const { newId } = await inquirer.prompt([{ name: 'newId', message: 'Enter new Tenant ID:', default: selectedTenantId }]);
                selectedTenantId = newId;
                token = generateToken(selectedTenantId);
                console.log(chalk.green(`Switched to Tenant: ${selectedTenantId}`));
                break;

            case 'Exit':
                exit = true;
                break;
        }
        console.log('\n');
    }
}

(async () => {
    try {
        await startSystem();
        await mainLoop();
    } catch (error) {
        console.error(chalk.red('Fatal Error:'), error);
    } finally {
        await stopSystem();
        process.exit(0);
    }
})();
