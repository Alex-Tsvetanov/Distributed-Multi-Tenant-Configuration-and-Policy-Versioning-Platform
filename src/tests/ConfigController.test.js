const request = require('supertest');
const express = require('express');
const ConfigController = require('../controllers/ConfigController');
const { Config } = require('../models');
const { errorHandler } = require('../middleware');

describe('ConfigController', () => {
    let app;
    let tenantId;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Mock authentication middleware
        app.use((req, res, next) => {
            req.user = { email: 'test@example.com', tenantId };
            req.ip = '127.0.0.1';
            req.get = () => 'Test User Agent';
            next();
        });

        tenantId = 'tenant-test';

        // Setup routes
        app.post('/api/v1/configs', ConfigController.create);
        app.get('/api/v1/configs', ConfigController.list);
        app.get('/api/v1/configs/:configId', ConfigController.getById);
        app.put('/api/v1/configs/:configId', ConfigController.update);
        app.delete('/api/v1/configs/:configId', ConfigController.archive);

        // Add error handler
        app.use(errorHandler);
    });

    describe('create', () => {
        it('should create a new config', async () => {
            const configData = {
                name: 'test-config',
                description: 'Test description',
                environments: ['dev', 'prod'],
            };

            const response = await request(app)
                .post('/api/v1/configs')
                .send(configData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(configData.name);
            expect(response.body.data.tenantId).toBeDefined();
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/v1/configs')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('list', () => {
        beforeEach(async () => {
            await Config.create([
                {
                    tenantId,
                    name: 'config-1',
                    description: 'Config 1',
                    createdBy: 'test@example.com',
                },
                {
                    tenantId,
                    name: 'config-2',
                    description: 'Config 2',
                    createdBy: 'test@example.com',
                },
            ]);
        });

        it('should list configs with pagination', async () => {
            const response = await request(app)
                .get('/api/v1/configs')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.pagination).toBeDefined();
        });

        it('should respect limit parameter', async () => {
            const response = await request(app)
                .get('/api/v1/configs?limit=1')
                .expect(200);

            expect(response.body.data).toHaveLength(1);
        });

        it('should exclude archived configs by default', async () => {
            await Config.create({
                tenantId,
                name: 'archived-config',
                isArchived: true,
                createdBy: 'test@example.com',
            });

            const response = await request(app)
                .get('/api/v1/configs')
                .expect(200);

            const archived = response.body.data.find(c => c.name === 'archived-config');
            expect(archived).toBeUndefined();
        });
    });

    describe('getById', () => {
        let config;

        beforeEach(async () => {
            config = await Config.create({
                tenantId,
                name: 'test-config',
                createdBy: 'test@example.com',
            });
        });

        it('should get config by id', async () => {
            const response = await request(app)
                .get(`/api/v1/configs/${config._id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data._id.toString()).toBe(config._id.toString());
        });

        it('should return 404 for non-existent config', async () => {
            const response = await request(app)
                .get('/api/v1/configs/507f1f77bcf86cd799439011')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Config not found');
        });
    });

    describe('update', () => {
        let config;

        beforeEach(async () => {
            config = await Config.create({
                tenantId,
                name: 'test-config',
                description: 'Old description',
                createdBy: 'test@example.com',
            });
        });

        it('should update config', async () => {
            const updateData = {
                name: 'updated-config',
                description: 'New description',
            };

            const response = await request(app)
                .put(`/api/v1/configs/${config._id}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(updateData.name);
        });

        it('should return 404 for non-existent config', async () => {
            const response = await request(app)
                .put('/api/v1/configs/507f1f77bcf86cd799439011')
                .send({ name: 'test' })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });
});
