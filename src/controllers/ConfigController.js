const { Config } = require('../models');
const { AuditService } = require('../services');

class ConfigController {
    static async create(req, res, next) {
        try {
            const { name, description, environments = ['dev'], tags = [] } = req.body;
            const tenantId = req.params.tenantId || req.user.tenantId;

            const config = new Config({
                tenantId,
                name,
                description,
                environments,
                tags,
                createdBy: req.user.email
            });

            await config.save();

            await AuditService.log({
                entityType: 'config',
                entityId: config._id.toString(),
                tenantId,
                action: 'CREATE',
                performedBy: req.user.email,
                metadata: { name, environments },
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            res.status(201).json({
                success: true,
                data: config
            });
        } catch (error) {
            next(error);
        }
    }

    static async list(req, res, next) {
        try {
            const tenantId = req.params.tenantId || req.user.tenantId;
            const { page = 1, limit = 20, includeArchived = false } = req.query;

            const query = { tenantId };
            if (!includeArchived || includeArchived === 'false') {
                query.isArchived = false;
            }

            const configs = await Config.find(query)
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .lean();

            const total = await Config.countDocuments(query);

            res.json({
                success: true,
                data: configs,
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

    static async getById(req, res, next) {
        try {
            const { configId } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;

            const config = await Config.findOne({
                _id: configId,
                tenantId
            }).lean();

            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: 'Config not found'
                });
            }

            res.json({
                success: true,
                data: config
            });
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const { configId } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;
            const { name, description, environments, tags } = req.body;

            const existingConfig = await Config.findOne({ _id: configId, tenantId });

            if (!existingConfig) {
                return res.status(404).json({
                    success: false,
                    error: 'Config not found'
                });
            }

            if (existingConfig.isArchived) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update an archived configuration. Restore it first.'
                });
            }

            existingConfig.name = name || existingConfig.name;
            existingConfig.description = description || existingConfig.description;
            existingConfig.environments = environments || existingConfig.environments;
            existingConfig.tags = tags || existingConfig.tags;
            existingConfig.updatedAt = new Date();

            await existingConfig.save();

            await AuditService.log({
                entityType: 'config',
                entityId: configId,
                tenantId,
                action: 'UPDATE',
                performedBy: req.user.email,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            res.json({
                success: true,
                data: existingConfig
            });
        } catch (error) {
            next(error);
        }
    }

    static async archive(req, res, next) {
        try {
            const { configId } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;

            const config = await Config.findOneAndUpdate(
                { _id: configId, tenantId },
                { isArchived: true, updatedAt: new Date() },
                { new: true }
            );

            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: 'Config not found'
                });
            }

            await AuditService.log({
                entityType: 'config',
                entityId: configId,
                tenantId,
                action: 'ARCHIVE',
                performedBy: req.user.email,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            res.json({
                success: true,
                message: 'Config archived successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async restore(req, res, next) {
        try {
            const { configId } = req.params;
            const tenantId = req.params.tenantId || req.user.tenantId;

            const config = await Config.findOneAndUpdate(
                { _id: configId, tenantId },
                { isArchived: false, updatedAt: new Date() },
                { new: true }
            );

            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: 'Config not found'
                });
            }

            await AuditService.log({
                entityType: 'config',
                entityId: configId,
                tenantId,
                action: 'RESTORE',
                performedBy: req.user.email,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            res.json({
                success: true,
                message: 'Config restored successfully'
            });
        } catch (error) {
            next(error);
        }
    }

    static async getActiveVersion(req, res, next) {
        try {
            const { configId } = req.params;
            const { environment = 'dev' } = req.query;
            const tenantId = req.params.tenantId || req.user.tenantId;

            const config = await Config.findOne({
                _id: configId,
                tenantId
            }).lean();

            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: 'Config not found'
                });
            }

            const activeVersion = config.activeVersions[environment];

            if (!activeVersion) {
                return res.status(404).json({
                    success: false,
                    error: `No active version for environment: ${environment}`
                });
            }

            const { ConfigVersion } = require('../models');
            const version = await ConfigVersion.findOne({
                configId,
                tenantId,
                version: activeVersion
            }).lean();

            if (!version) {
                return res.status(404).json({
                    success: false,
                    error: 'Active version data not found'
                });
            }

            res.json({
                success: true,
                data: {
                    configId,
                    environment,
                    version: activeVersion,
                    data: version.data,
                    checksum: version.checksum,
                    updatedAt: version.createdAt
                }
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = ConfigController;
