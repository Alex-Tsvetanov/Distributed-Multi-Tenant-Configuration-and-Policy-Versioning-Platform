const { Tenant } = require('../models');
const { AuditService } = require('../services');

class TenantController {
    static async create(req, res, next) {
        try {
            const { _id, name, description, settings } = req.body;

            const existingTenant = await Tenant.findById(_id);
            if (existingTenant) {
                return res.status(409).json({
                    success: false,
                    error: 'Tenant with this ID already exists'
                });
            }

            const tenant = new Tenant({
                _id,
                name,
                description,
                settings
            });

            await tenant.save();

            await AuditService.log({
                entityType: 'tenant',
                entityId: _id,
                tenantId: _id,
                action: 'CREATE',
                performedBy: req.user?.email || 'system',
                metadata: { name }
            });

            res.status(201).json({
                success: true,
                data: tenant
            });
        } catch (error) {
            next(error);
        }
    }

    static async list(req, res, next) {
        try {
            const { page = 1, limit = 20, includeInactive = false } = req.query;

            const query = {};
            if (!includeInactive || includeInactive === 'false') {
                query.isActive = true;
            }

            const tenants = await Tenant.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .lean();

            const total = await Tenant.countDocuments(query);

            res.json({
                success: true,
                data: tenants,
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
            const { tenantId } = req.params;

            const tenant = await Tenant.findById(tenantId).lean();

            if (!tenant) {
                return res.status(404).json({
                    success: false,
                    error: 'Tenant not found'
                });
            }

            res.json({
                success: true,
                data: tenant
            });
        } catch (error) {
            next(error);
        }
    }

    static async update(req, res, next) {
        try {
            const { tenantId } = req.params;
            const { name, description, settings } = req.body;

            const tenant = await Tenant.findByIdAndUpdate(
                tenantId,
                {
                    name,
                    description,
                    settings,
                    updatedAt: new Date()
                },
                { new: true }
            );

            if (!tenant) {
                return res.status(404).json({
                    success: false,
                    error: 'Tenant not found'
                });
            }

            await AuditService.log({
                entityType: 'tenant',
                entityId: tenantId,
                tenantId,
                action: 'UPDATE',
                performedBy: req.user?.email || 'system'
            });

            res.json({
                success: true,
                data: tenant
            });
        } catch (error) {
            next(error);
        }
    }

    static async deactivate(req, res, next) {
        try {
            const { tenantId } = req.params;

            const tenant = await Tenant.findByIdAndUpdate(
                tenantId,
                { isActive: false, updatedAt: new Date() },
                { new: true }
            );

            if (!tenant) {
                return res.status(404).json({
                    success: false,
                    error: 'Tenant not found'
                });
            }

            await AuditService.log({
                entityType: 'tenant',
                entityId: tenantId,
                tenantId,
                action: 'DELETE',
                performedBy: req.user?.email || 'system'
            });

            res.json({
                success: true,
                message: 'Tenant deactivated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = TenantController;
