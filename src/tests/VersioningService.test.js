const VersioningService = require('../services/VersioningService');
const { Config } = require('../models');

describe('VersioningService', () => {
  let testConfig;
  let tenantId;

  beforeEach(async () => {
    tenantId = 'tenant-test';
    testConfig = await Config.create({
      tenantId,
      name: 'test-config',
      description: 'Test configuration',
      environments: ['dev', 'prod'],
      createdBy: 'test@example.com',
    });
  });

  describe('createVersion', () => {
    it('should create a new version', async () => {
      const data = { feature: true, setting: 'value' };

      const version = await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data,
        createdBy: 'test@example.com',
      });

      expect(version).toBeDefined();
      expect(version.version).toBe(1);
      expect(version.configId.toString()).toBe(testConfig._id.toString());
      expect(version.data).toEqual(data);
    });

    it('should increment version number', async () => {
      await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { v: 1 },
        createdBy: 'test@example.com',
      });

      const version2 = await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { v: 2 },
        createdBy: 'test@example.com',
      });

      expect(version2.version).toBe(2);
    });

    it('should throw error for non-existent config', async () => {
      await expect(
        VersioningService.createVersion({
          configId: '507f1f77bcf86cd799439011',
          tenantId,
          data: {},
          createdBy: 'test@example.com',
        })
      ).rejects.toThrow('Config not found');
    });

    it('should auto-generate changelog if not provided', async () => {
      await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { feature: true },
        createdBy: 'test@example.com',
      });

      const version2 = await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { feature: false },
        createdBy: 'test@example.com',
      });

      expect(version2.changeLog).toBeDefined();
      expect(version2.changeLog).not.toBe('');
    });

    it('should set parentVersion to previous version', async () => {
      const v1 = await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { v: 1 },
        createdBy: 'test@example.com',
      });

      const v2 = await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { v: 2 },
        createdBy: 'test@example.com',
      });

      expect(v2.parentVersion).toBe(v1.version);
    });

    it('should support custom branch', async () => {
      const version = await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { feature: true },
        branch: 'experiment',
        createdBy: 'test@example.com',
      });

      expect(version.branch).toBe('experiment');
    });
  });

  describe('rollback', () => {
    beforeEach(async () => {
      await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { version: 1 },
        createdBy: 'test@example.com',
      });

      await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { version: 2 },
        createdBy: 'test@example.com',
      });

      testConfig.activeVersions = { dev: 2, prod: 2 };
      await testConfig.save();
    });

    it('should rollback to target version', async () => {
      const result = await VersioningService.rollback({
        configId: testConfig._id,
        tenantId,
        environment: 'dev',
        targetVersion: 1,
        performedBy: 'admin@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.previousVersion).toBe(2);
      expect(result.currentVersion).toBe(1);

      const updatedConfig = await Config.findById(testConfig._id);
      expect(updatedConfig.activeVersions.dev).toBe(1);
    });

    it('should throw error for non-existent config', async () => {
      await expect(
        VersioningService.rollback({
          configId: '507f1f77bcf86cd799439011',
          tenantId,
          environment: 'dev',
          targetVersion: 1,
          performedBy: 'admin@example.com',
        })
      ).rejects.toThrow('Config not found');
    });

    it('should throw error for non-existent target version', async () => {
      await expect(
        VersioningService.rollback({
          configId: testConfig._id,
          tenantId,
          environment: 'dev',
          targetVersion: 999,
          performedBy: 'admin@example.com',
        })
      ).rejects.toThrow('Target version not found');
    });

    it('should include reason in audit log', async () => {
      const result = await VersioningService.rollback({
        configId: testConfig._id,
        tenantId,
        environment: 'prod',
        targetVersion: 1,
        performedBy: 'admin@example.com',
        reason: 'Critical bug in version 2',
      });

      expect(result.rolledBackAt).toBeDefined();
    });
  });

  describe('getVersionHistory', () => {
    beforeEach(async () => {
      await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { v: 1 },
        branch: 'main',
        createdBy: 'test@example.com',
      });

      await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { v: 2 },
        branch: 'main',
        createdBy: 'test@example.com',
      });

      await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { v: 3 },
        branch: 'experiment',
        createdBy: 'test@example.com',
      });
    });

    it('should get version history', async () => {
      const history = await VersioningService.getVersionHistory(
        testConfig._id,
        tenantId,
        {}
      );

      expect(history).toHaveLength(3);
    });

    it('should filter by branch', async () => {
      const history = await VersioningService.getVersionHistory(
        testConfig._id,
        tenantId,
        { branch: 'main' }
      );

      expect(history).toHaveLength(2);
    });

    it('should respect limit option', async () => {
      const history = await VersioningService.getVersionHistory(
        testConfig._id,
        tenantId,
        { limit: 2 }
      );

      expect(history).toHaveLength(2);
    });
  });

  describe('compareVersions', () => {
    beforeEach(async () => {
      await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { feature: false, setting: 'old' },
        createdBy: 'test@example.com',
      });

      await VersioningService.createVersion({
        configId: testConfig._id,
        tenantId,
        data: { feature: true, setting: 'new', extra: 'added' },
        createdBy: 'test@example.com',
      });
    });

    it('should compare two versions', async () => {
      const comparison = await VersioningService.compareVersions(
        testConfig._id,
        tenantId,
        1,
        2
      );

      expect(comparison.hasChanges).toBe(true);
      expect(comparison.fromVersion).toBe(1);
      expect(comparison.toVersion).toBe(2);
    });
  });
});
