const { ConfigVersion } = require('../models');
const { VersioningService, DiffService } = require('../services');

class VersioningController {
    static async createVersion(req, res, next) {
        try {
            const { configId } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;
            const { data, branch = 'main', parentVersion, changeLog } = req.body;

            const version = await VersioningService.createVersion({
                configId,
                tenantId,
                data,
                branch,
                parentVersion,
                changeLog,
                createdBy: req.user.email,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            res.status(201).json({
                success: true,
                data: version
            });
        } catch (error) {
            next(error);
        }
    }

    static async listVersions(req, res, next) {
        try {
            const { configId } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;
            const { branch, page = 1, limit = 20 } = req.query;

            const versions = await VersioningService.getVersionHistory(
                configId,
                tenantId,
                {
                    branch,
                    limit: parseInt(limit),
                    skip: (page - 1) * limit
                }
            );

            const total = await ConfigVersion.countDocuments({
                configId,
                tenantId,
                ...(branch && { branch })
            });

            res.json({
                success: true,
                data: versions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            next(error);
        }
    }

    static async getVersion(req, res, next) {
        try {
            const { configId, version } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;

            const versionDoc = await ConfigVersion.findOne({
                configId,
                tenantId,
                version: parseInt(version)
            }).lean();

            if (!versionDoc) {
                return res.status(404).json({
                    success: false,
                    error: 'Version not found'
                });
            }

            res.json({
                success: true,
                data: versionDoc
            });
        } catch (error) {
            next(error);
        }
    }

    static async rollback(req, res, next) {
        try {
            const { configId } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;
            const { environment, targetVersion, reason } = req.body;

            const result = await VersioningService.rollback({
                configId,
                tenantId,
                environment,
                targetVersion,
                performedBy: req.user.email,
                reason,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    static async deploy(req, res, next) {
        try {
            const { configId } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;
            const { version, environment } = req.body;

            const result = await VersioningService.deployVersion({
                configId,
                tenantId,
                version,
                environment,
                performedBy: req.user.email,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    static async createBranch(req, res, next) {
        try {
            const { configId } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;
            const { newBranch, sourceVersion, data, changeLog } = req.body;

            const version = await VersioningService.createBranch({
                configId,
                tenantId,
                newBranch,
                sourceVersion,
                data,
                createdBy: req.user.email,
                changeLog,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            res.status(201).json({
                success: true,
                data: version
            });
        } catch (error) {
            next(error);
        }
    }

    static async compare(req, res, next) {
        try {
            const { configId } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;
            const { v1, v2 } = req.query;

            if (!v1 || !v2) {
                return res.status(400).json({
                    success: false,
                    error: 'Both v1 and v2 query parameters are required'
                });
            }

            const comparison = await VersioningService.compareVersions(
                configId,
                tenantId,
                parseInt(v1),
                parseInt(v2)
            );

            res.json({
                success: true,
                data: comparison
            });
        } catch (error) {
            next(error);
        }
    }

    static async diff(req, res, next) {
        try {
            const { configId } = req.params;
            const { version1, version2 } = req.body;
            const tenantId = req.params.tenantId || req.user.tenantId;

            const [v1, v2] = await Promise.all([
                ConfigVersion.findOne({ configId, tenantId, version: version1 }).lean(),
                ConfigVersion.findOne({ configId, tenantId, version: version2 }).lean()
            ]);

            if (!v1 || !v2) {
                return res.status(404).json({
                    success: false,
                    error: 'One or both versions not found'
                });
            }

            const diff = DiffService.computeDiff(v1.data, v2.data);

            res.json({
                success: true,
                data: {
                    version1: { version: v1.version, checksum: v1.checksum },
                    version2: { version: v2.version, checksum: v2.checksum },
                    diff
                }
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = VersioningController;
