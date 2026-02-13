const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    tenantId: {
        type: String,
        required: true,
        ref: 'Tenant',
        index: true
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
    environments: [{
        type: String,
        enum: ['dev', 'staging', 'prod', 'test'],
        default: ['dev']
    }],
    activeVersions: {
        dev: {
            type: Number,
            default: null
        },
        staging: {
            type: Number,
            default: null
        },
        prod: {
            type: Number,
            default: null
        },
        test: {
            type: Number,
            default: null
        }
    },
    tags: [{
        type: String,
        trim: true
    }],
    isArchived: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: String,
        required: true
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

configSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

configSchema.index({ tenantId: 1, name: 1 }, { unique: true });
configSchema.index({ tenantId: 1, isArchived: 1 });
configSchema.index({ tags: 1 });

module.exports = mongoose.model('Config', configSchema);
