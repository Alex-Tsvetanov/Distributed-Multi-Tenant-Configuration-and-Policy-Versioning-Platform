const mongoose = require('mongoose');
const crypto = require('crypto');

const configVersionSchema = new mongoose.Schema({
    configId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Config',
        index: true
    },
    tenantId: {
        type: String,
        required: true,
        ref: 'Tenant',
        index: true
    },
    version: {
        type: Number,
        required: true
    },
    branch: {
        type: String,
        default: 'main',
        index: true
    },
    parentVersion: {
        type: Number,
        default: null
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        validate: {
            validator: function(v) {
                return typeof v === 'object' && v !== null;
            },
            message: 'Data must be a valid JSON object'
        }
    },
    checksum: {
        type: String,
        required: true
    },
    changeLog: {
        type: String,
        trim: true
    },
    createdBy: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isArchived: {
        type: Boolean,
        default: false
    }
});

configVersionSchema.pre('validate', function(next) {
    if (this.data) {
        const dataString = JSON.stringify(this.data, Object.keys(this.data).sort());
        this.checksum = crypto.createHash('sha256').update(dataString).digest('hex');
    }
    next();
});

configVersionSchema.index({ configId: 1, version: -1 }, { unique: true });
configVersionSchema.index({ tenantId: 1, branch: 1 });
configVersionSchema.index({ createdAt: -1 });
configVersionSchema.index({ checksum: 1 });

configVersionSchema.statics.getNextVersion = async function(configId) {
    const lastVersion = await this.findOne({ configId })
        .sort({ version: -1 })
        .select('version');
    return lastVersion ? lastVersion.version + 1 : 1;
};

module.exports = mongoose.model('ConfigVersion', configVersionSchema);
