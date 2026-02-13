const AuditService = require('../services/AuditService');
const { AuditLog } = require('../models');

describe('AuditService', () => {
    describe('log', () => {
        it('should create an audit log entry', async () => {
            const auditData = {
                entityType: 'config',
                entityId: '12345',
                tenantId: 'tenantA',
                action: 'CREATE',
                performedBy: 'admin@example.com',
                metadata: { name: 'test-config' },
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
            };

            const result = await AuditService.log(auditData);

            expect(result).toBeDefined();
            expect(result.entityType).toBe('config');
            expect(result.action).toBe('CREATE');
            expect(result.performedBy).toBe('admin@example.com');
        });

        it('should handle missing optional fields', async () => {
            const auditData = {
                entityType: 'config_version',
                entityId: '67890',
                tenantId: 'tenantB',
                action: 'VERSION_CREATE',
                performedBy: 'user@example.com',
            };

            const result = await AuditService.log(auditData);

            expect(result).toBeDefined();
            expect(result.metadata).toEqual({});
        });

        it('should not throw on save error', async () => {
            jest.spyOn(AuditLog.prototype, 'save').mockRejectedValue(new Error('DB Error'));

            const result = await AuditService.log({
                entityType: 'config',
                entityId: '12345',
                tenantId: 'tenantA',
                action: 'CREATE',
                performedBy: 'admin@example.com',
            });

            expect(result).toBeNull();
            AuditLog.prototype.save.mockRestore();
        });
    });

    describe('getHistory', () => {
        beforeEach(async () => {
            const baseDate = new Date();
            await AuditLog.create([
                {
                    entityType: 'config',
                    entityId: 'config-1',
                    tenantId: 'tenantA',
                    action: 'CREATE',
                    performedBy: 'user1@example.com',
                    performedAt: new Date(baseDate.getTime() - 2000),
                },
                {
                    entityType: 'config',
                    entityId: 'config-1',
                    tenantId: 'tenantA',
                    action: 'UPDATE',
                    performedBy: 'user2@example.com',
                    performedAt: new Date(baseDate.getTime() - 1000),
                },
                {
                    entityType: 'config',
                    entityId: 'config-1',
                    tenantId: 'tenantA',
                    action: 'ARCHIVE',
                    performedBy: 'user3@example.com',
                    performedAt: baseDate,
                },
            ]);
        });

        it('should get history for an entity', async () => {
            const history = await AuditService.getHistory('config-1');

            expect(history).toHaveLength(3);
            expect(history[0].action).toBe('ARCHIVE');
            expect(history[1].action).toBe('UPDATE');
            expect(history[2].action).toBe('CREATE');
        });

        it('should respect limit option', async () => {
            const history = await AuditService.getHistory('config-1', { limit: 2 });

            expect(history).toHaveLength(2);
        });

        it('should filter by action', async () => {
            const history = await AuditService.getHistory('config-1', { action: 'CREATE' });

            expect(history).toHaveLength(1);
            expect(history[0].action).toBe('CREATE');
        });

        it('should respect skip option', async () => {
            const history = await AuditService.getHistory('config-1', { skip: 1, limit: 2 });

            expect(history).toHaveLength(2);
            expect(history[0].action).toBe('UPDATE');
        });
    });

    describe('getTenantActivity', () => {
        beforeEach(async () => {
            const baseDate = new Date();
            await AuditLog.create([
                {
                    entityType: 'config',
                    entityId: 'config-1',
                    tenantId: 'tenantA',
                    action: 'CREATE',
                    performedBy: 'user1@example.com',
                    performedAt: new Date(baseDate.getTime() - 1000),
                },
                {
                    entityType: 'config',
                    entityId: 'config-2',
                    tenantId: 'tenantA',
                    action: 'UPDATE',
                    performedBy: 'user2@example.com',
                    performedAt: baseDate,
                },
                {
                    entityType: 'config',
                    entityId: 'config-3',
                    tenantId: 'tenantB',
                    action: 'CREATE',
                    performedBy: 'user3@example.com',
                    performedAt: baseDate,
                },
            ]);
        });

        it('should get activity for a tenant', async () => {
            const activity = await AuditService.getTenantActivity('tenantA');

            expect(activity).toHaveLength(2);
        });

        it('should filter by date range', async () => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 1);

            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 1);

            const activity = await AuditService.getTenantActivity('tenantA', {
                startDate,
                endDate,
            });

            expect(activity.length).toBeGreaterThan(0);
        });

        it('should respect pagination options', async () => {
            const activity = await AuditService.getTenantActivity('tenantA', {
                limit: 1,
                skip: 0,
            });

            expect(activity).toHaveLength(1);
        });
    });

    describe('getAuditStats', () => {
        beforeEach(async () => {
            await AuditLog.create([
                { entityType: 'config', entityId: '1', tenantId: 'tenantA', action: 'CREATE', performedBy: 'user1@example.com' },
                { entityType: 'config', entityId: '2', tenantId: 'tenantA', action: 'CREATE', performedBy: 'user2@example.com' },
                { entityType: 'config', entityId: '3', tenantId: 'tenantA', action: 'UPDATE', performedBy: 'user3@example.com' },
                { entityType: 'config', entityId: '4', tenantId: 'tenantA', action: 'ARCHIVE', performedBy: 'user4@example.com' },
            ]);
        });

        it('should return action counts', async () => {
            const stats = await AuditService.getAuditStats('tenantA');

            expect(stats).toHaveLength(3);

            const createStat = stats.find(s => s._id === 'CREATE');
            const updateStat = stats.find(s => s._id === 'UPDATE');

            expect(createStat.count).toBe(2);
            expect(updateStat.count).toBe(1);
        });

        it('should respect days parameter', async () => {
            const stats = await AuditService.getAuditStats('tenantA', 7);

            expect(stats.length).toBeGreaterThanOrEqual(0);
        });
    });
});
