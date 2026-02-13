const express = require('express');
const configRoutes = require('./config');
const tenantRoutes = require('./tenant');

const router = express.Router();

router.use('/tenants', tenantRoutes);
router.use('/tenants/:tenantId/configs', configRoutes);
router.use('/configs', configRoutes);

module.exports = router;
