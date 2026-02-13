const { Config, ConfigVersion } = require('../models');
const DiffService = require('./DiffService');
const AuditService = require('./AuditService');

class VersioningService {
    static async createVersion({
        configId,
        tenantId,
        data,
        branch = 'main',
        parentVersion = null,
        changeLog = null,
        createdBy,
        ipAddress = null,
        userAgent = null
    }) {
        const config = await Config.findOne({ _id: configId, tenantId });
        if (!config) {
            const error = new Error('Config not found');
            error.status = 404;
            throw error;
        }

        if (config.isArchived) {
            const error = new Error('Cannot create versions for an archived configuration. Restore it first.');
            error.status = 400;
            throw error;
        }

        const nextVersion = await ConfigVersion.getNextVersion(configId);

        let finalParentVersion = parentVersion;
        let finalChangeLog = changeLog;

        if (!parentVersion && nextVersion > 1) {
            const currentVersion = await ConfigVersion.findOne({
                configId,
                branch
            }).sort({ version: -1 });

            if (currentVersion) {
                finalParentVersion = currentVersion.version;

                if (!changeLog) {
                    const diff = DiffService.computeDiff(currentVersion.data, data);
                    finalChangeLog = DiffService.generateChangeLog(diff);
                }
            }
        }

        const version = new ConfigVersion({
            configId,
            tenantId,
            version: nextVersion,
            branch,
            parentVersion: finalParentVersion,
            data,
            changeLog: finalChangeLog,
            createdBy
        });

        await version.save();

        await AuditService.log({
            entityType: 'config_version',
            entityId: version._id.toString(),
            tenantId,
            action: 'VERSION_CREATE',
            performedBy: createdBy,
            metadata: {
                configId: configId.toString(),
                version: nextVersion,
                branch,
                parentVersion: finalParentVersion
            },
            ipAddress,
            userAgent
        });

        return version;
    }

    static async rollback({
        configId,
        tenantId,
        environment,
        targetVersion,
        performedBy,
        reason = null,
        ipAddress = null,
        userAgent = null
    }) {
        const config = await Config.findOne({ _id: configId, tenantId });
        if (!config) {
            const error = new Error('Config not found');
            error.status = 404;
            throw error;
        }

        const targetVersionDoc = await ConfigVersion.findOne({
            configId,
            tenantId,
            version: targetVersion
        });

        if (!targetVersionDoc) {
            const error = new Error('Target version not found');
            error.status = 404;
            throw error;
        }

        const currentVersion = config.activeVersions[environment];

        config.activeVersions[environment] = targetVersion;
        await config.save();

        await AuditService.log({
            entityType: 'config',
            entityId: configId.toString(),
            tenantId,
            action: 'ROLLBACK',
            performedBy,
            metadata: {
                environment,
                fromVersion: currentVersion,
                toVersion: targetVersion,
                reason
            },
            ipAddress,
            userAgent
        });

        return {
            success: true,
            configId,
            environment,
            previousVersion: currentVersion,
            currentVersion: targetVersion,
            rolledBackAt: new Date()
        };
    }

    static async createBranch({
        configId,
        tenantId,
        newBranch,
        sourceVersion,
        data,
        createdBy,
        changeLog = null,
        ipAddress = null,
        userAgent = null
    }) {
        const config = await Config.findOne({ _id: configId, tenantId });
        if (!config) {
            const error = new Error('Config not found');
            error.status = 404;
            throw error;
        }

        const existingBranch = await ConfigVersion.findOne({
            configId,
            tenantId,
            branch: newBranch
        });

        if (existingBranch) {
            const error = new Error(`Branch '${newBranch}' already exists`);
            error.status = 400;
            throw error;
        }

        const nextVersion = await ConfigVersion.getNextVersion(configId);

        const version = new ConfigVersion({
            configId,
            tenantId,
            version: nextVersion,
            branch: newBranch,
            parentVersion: sourceVersion,
            data,
            changeLog: changeLog || `Branch created from version ${sourceVersion}`,
            createdBy
        });

        await version.save();

        await AuditService.log({
            entityType: 'config_version',
            entityId: version._id.toString(),
            tenantId,
            action: 'BRANCH_CREATE',
            performedBy: createdBy,
            metadata: {
                configId: configId.toString(),
                newBranch,
                sourceVersion,
                newVersion: nextVersion
            },
            ipAddress,
            userAgent
        });

        return version;
    }

    static async deployVersion({
        configId,
        tenantId,
        version,
        environment,
        performedBy,
        ipAddress = null,
        userAgent = null
    }) {
        const config = await Config.findOne({ _id: configId, tenantId });
        if (!config) {
            const error = new Error('Config not found');
            error.status = 404;
            throw error;
        }

        if (config.isArchived) {
            const error = new Error('Cannot deploy an archived configuration. Restore it first.');
            error.status = 400;
            throw error;
        }

        if (!config.environments.includes(environment)) {
            const error = new Error(`Environment '${environment}' not configured for this config`);
            error.status = 400;
            throw error;
        }

        const versionDoc = await ConfigVersion.findOne({
            configId,
            tenantId,
            version
        });

        if (!versionDoc) {
            const error = new Error('Version not found');
            error.status = 404;
            throw error;
        }

        const previousVersion = config.activeVersions[environment];
        config.activeVersions[environment] = version;
        await config.save();

        await AuditService.log({
            entityType: 'config',
            entityId: configId.toString(),
            tenantId,
            action: 'DEPLOY',
            performedBy,
            metadata: {
                environment,
                previousVersion,
                deployedVersion: version,
                branch: versionDoc.branch
            },
            ipAddress,
            userAgent
        });

        return {
            success: true,
            configId,
            environment,
            previousVersion,
            deployedVersion: version,
            deployedAt: new Date()
        };
    }

    static async getVersionHistory(configId, tenantId, options = {}) {
        const { branch = null, limit = 50, skip = 0 } = options;

        const query = { configId, tenantId };
        if (branch) {
            query.branch = branch;
        }

        return await ConfigVersion.find(query)
            .sort({ version: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
    }

    static async compareVersions(configId, tenantId, version1, version2) {
        const [v1, v2] = await Promise.all([
            ConfigVersion.findOne({ configId, tenantId, version: version1 }).lean(),
            ConfigVersion.findOne({ configId, tenantId, version: version2 }).lean()
        ]);

        if (!v1) {
            const error = new Error(`Version ${version1} not found`);
            error.status = 404;
            throw error;
        }
        if (!v2) {
            const error = new Error(`Version ${version2} not found`);
            error.status = 404;
            throw error;
        }

        const diff = DiffService.computeDiff(v1.data, v2.data);

        return {
            version1: {
                version: v1.version,
                branch: v1.branch,
                createdAt: v1.createdAt,
                createdBy: v1.createdBy,
                checksum: v1.checksum
            },
            version2: {
                version: v2.version,
                branch: v2.branch,
                createdAt: v2.createdAt,
                createdBy: v2.createdBy,
                checksum: v2.checksum
            },
            diff
        };
    }
}

module.exports = VersioningService;
