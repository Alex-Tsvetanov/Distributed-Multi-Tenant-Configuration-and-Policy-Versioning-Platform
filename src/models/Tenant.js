const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    settings: {
        maxConfigs: {
            type: Number,
            default: 100
        },
        maxVersionsPerConfig: {
            type: Number,
            default: 1000
        },
        retentionDays: {
            type: Number,
            default: 365
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

tenantSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

tenantSchema.index({ isActive: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);
