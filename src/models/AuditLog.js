const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    entityType: {
        type: String,
        required: true,
        enum: ['config', 'config_version', 'tenant', 'user'],
        index: true
    },
    entityId: {
        type: String,
        required: true,
        index: true
    },
    tenantId: {
        type: String,
        ref: 'Tenant',
        index: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            'CREATE',
            'UPDATE',
            'DELETE',
            'VERSION_CREATE',
            'VERSION_DELETE',
            'ROLLBACK',
            'BRANCH_CREATE',
            'DEPLOY',
            'ARCHIVE',
            'RESTORE',
            'VIEW'
        ]
    },
    performedBy: {
        type: String,
        required: true
    },
    performedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
});

auditLogSchema.index({ entityId: 1, performedAt: -1 });
auditLogSchema.index({ tenantId: 1, performedAt: -1 });
auditLogSchema.index({ action: 1, performedAt: -1 });
auditLogSchema.index({ performedBy: 1, performedAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
