const { AuditLog } = require('../models');

class AuditService {
    static async log({
        entityType,
        entityId,
        tenantId,
        action,
        performedBy,
        metadata = {},
        ipAddress = null,
        userAgent = null
    }) {
        try {
            const auditEntry = new AuditLog({
                entityType,
                entityId,
                tenantId,
                action,
                performedBy,
                metadata,
                ipAddress,
                userAgent
            });

            await auditEntry.save();
            return auditEntry;
        } catch (error) {
            console.error('Failed to create audit log:', error);
            return null;
        }
    }

    static async getHistory(entityId, options = {}) {
        const { limit = 50, skip = 0, action = null } = options;

        const query = { entityId };
        if (action) {
            query.action = action;
        }

        return await AuditLog.find(query)
            .sort({ performedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
    }

    static async getTenantActivity(tenantId, options = {}) {
        const { limit = 50, skip = 0, startDate = null, endDate = null } = options;

        const query = { tenantId };
        
        if (startDate || endDate) {
            query.performedAt = {};
            if (startDate) query.performedAt.$gte = new Date(startDate);
            if (endDate) query.performedAt.$lte = new Date(endDate);
        }

        return await AuditLog.find(query)
            .sort({ performedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
    }

    static async getAuditStats(tenantId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await AuditLog.aggregate([
            {
                $match: {
                    tenantId,
                    performedAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);
    }
}

module.exports = AuditService;
