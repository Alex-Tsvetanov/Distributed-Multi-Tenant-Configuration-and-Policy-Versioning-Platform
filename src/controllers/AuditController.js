const { AuditService } = require('../services');
const { AuditLog } = require('../models');

class AuditController {
    static async getHistory(req, res, next) {
        try {
            const { entityId } = req.params;
            const { page = 1, limit = 50, action } = req.query;

            const history = await AuditService.getHistory(entityId, {
                limit: parseInt(limit),
                skip: (page - 1) * limit,
                action
            });

            const total = await AuditLog.countDocuments({
                entityId,
                ...(action && { action })
            });

            res.json({
                success: true,
                data: history,
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

    static async getTenantActivity(req, res, next) {
        try {
            const { tenantId } = req.params;
            const { page = 1, limit = 50, startDate, endDate } = req.query;

            const activity = await AuditService.getTenantActivity(tenantId, {
                limit: parseInt(limit),
                skip: (page - 1) * limit,
                startDate,
                endDate
            });

            res.json({
                success: true,
                data: activity
            });
        } catch (error) {
            next(error);
        }
    }

    static async getStats(req, res, next) {
        try {
            const { tenantId } = req.params;
            const { days = 30 } = req.query;

            const stats = await AuditService.getAuditStats(tenantId, parseInt(days));

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    static async getUserActivity(req, res, next) {
        try {
            const { performedBy } = req.params;
            const { page = 1, limit = 50 } = req.query;

            const activity = await AuditLog.find({ performedBy })
                .sort({ performedAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .lean();

            const total = await AuditLog.countDocuments({ performedBy });

            res.json({
                success: true,
                data: activity,
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
}

module.exports = AuditController;
