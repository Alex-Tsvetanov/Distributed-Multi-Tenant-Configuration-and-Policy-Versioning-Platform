const express = require('express');
const { TenantController, AuditController } = require('../controllers');
const { authenticate, validate, authorize } = require('../middleware');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize(['admin']), validate.createTenant, TenantController.create);
router.get('/', authorize(['admin']), TenantController.list);
router.get('/:tenantId', authorize(['admin']), TenantController.getById);
router.put('/:tenantId', authorize(['admin']), validate.updateTenant, TenantController.update);
router.delete('/:tenantId', authorize(['admin']), TenantController.deactivate);

router.get('/:tenantId/activity', authorize(['admin']), AuditController.getTenantActivity);
router.get('/:tenantId/stats', authorize(['admin']), AuditController.getStats);

module.exports = router;
