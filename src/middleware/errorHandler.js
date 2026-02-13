const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            details: Object.values(err.errors).map(e => e.message)
        });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: 'Invalid ID format'
        });
    }

    if (err.code === 11000) {
        return res.status(409).json({
            success: false,
            error: 'Duplicate entry',
            details: err.message
        });
    }

    if (err.name === 'MongoNetworkError') {
        return res.status(503).json({
            success: false,
            error: 'Database connection error'
        });
    }

    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
};

const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.originalUrl} not found`
    });
};

module.exports = { errorHandler, notFound };
