const { authenticate, authorize } = require('./auth');
const { validate } = require('./validation');
const { errorHandler, notFound } = require('./errorHandler');

module.exports = {
    authenticate,
    authorize,
    validate,
    errorHandler,
    notFound
};
