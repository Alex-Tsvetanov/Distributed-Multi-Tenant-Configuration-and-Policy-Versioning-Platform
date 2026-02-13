const Joi = require('joi');

const schemas = {
    createTenant: Joi.object({
        _id: Joi.string().required().min(3).max(50),
        name: Joi.string().required().min(2).max(100),
        description: Joi.string().max(500),
        settings: Joi.object({
            maxConfigs: Joi.number().integer().min(1).max(10000),
            maxVersionsPerConfig: Joi.number().integer().min(1).max(10000),
            retentionDays: Joi.number().integer().min(1).max(3650)
        })
    }),

    updateTenant: Joi.object({
        name: Joi.string().min(2).max(100),
        description: Joi.string().max(500),
        settings: Joi.object({
            maxConfigs: Joi.number().integer().min(1).max(10000),
            maxVersionsPerConfig: Joi.number().integer().min(1).max(10000),
            retentionDays: Joi.number().integer().min(1).max(3650)
        })
    }),

    createConfig: Joi.object({
        name: Joi.string().required().min(2).max(100),
        description: Joi.string().max(500),
        environments: Joi.array().items(
            Joi.string().valid('dev', 'staging', 'prod', 'test')
        ).min(1),
        tags: Joi.array().items(Joi.string().max(50))
    }),

    updateConfig: Joi.object({
        name: Joi.string().min(2).max(100),
        description: Joi.string().max(500),
        environments: Joi.array().items(
            Joi.string().valid('dev', 'staging', 'prod', 'test')
        ),
        tags: Joi.array().items(Joi.string().max(50))
    }),

    createVersion: Joi.object({
        data: Joi.object().required(),
        branch: Joi.string().max(50).default('main'),
        parentVersion: Joi.number().integer().min(1).allow(null),
        changeLog: Joi.string().max(500)
    }),

    rollback: Joi.object({
        environment: Joi.string().valid('dev', 'staging', 'prod', 'test').required(),
        targetVersion: Joi.number().integer().min(1).required(),
        reason: Joi.string().max(500)
    }),

    deploy: Joi.object({
        version: Joi.number().integer().min(1).required(),
        environment: Joi.string().valid('dev', 'staging', 'prod', 'test').required()
    }),

    createBranch: Joi.object({
        newBranch: Joi.string().required().min(1).max(50),
        sourceVersion: Joi.number().integer().min(1).required(),
        data: Joi.object().required(),
        changeLog: Joi.string().max(500)
    }),

    diff: Joi.object({
        version1: Joi.number().integer().min(1).required(),
        version2: Joi.number().integer().min(1).required()
    })
};

const validate = (schemaName) => {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            return next();
        }

        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            const messages = error.details.map(d => d.message).join(', ');
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                details: messages
            });
        }

        next();
    };
};

// Add pre-bound middlewares for easier usage in routes
Object.keys(schemas).forEach(schemaName => {
    validate[schemaName] = validate(schemaName);
});

module.exports = { validate, schemas };
