const express = require('express');
const { ConfigController, VersioningController, AuditController } = require('../controllers');
const { authenticate, validate, authorize } = require('../middleware');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.post('/', authorize(['admin', 'editor']), validate.createConfig, ConfigController.create);
router.get('/', authorize(['admin', 'editor', 'viewer']), ConfigController.list);

router.get('/:configId', authorize(['admin', 'editor', 'viewer']), ConfigController.getById);
router.put('/:configId', authorize(['admin', 'editor']), validate.updateConfig, ConfigController.update);
router.delete('/:configId', authorize(['admin']), ConfigController.archive);
router.post('/:configId/restore', authorize(['admin', 'editor']), ConfigController.restore);

router.get('/:configId/active', authorize(['admin', 'editor', 'viewer']), ConfigController.getActiveVersion);

router.post(
    '/:configId/versions',
    authorize(['admin', 'editor']),
    validate.createVersion,
    VersioningController.createVersion
);
router.get('/:configId/versions', authorize(['admin', 'editor', 'viewer']), VersioningController.listVersions);
router.get('/:configId/versions/:version', authorize(['admin', 'editor', 'viewer']), VersioningController.getVersion);

router.post('/:configId/rollback', authorize(['admin', 'editor']), validate.rollback, VersioningController.rollback);
router.post('/:configId/deploy', authorize(['admin', 'editor']), validate.deploy, VersioningController.deploy);
router.post('/:configId/branches', authorize(['admin', 'editor']), validate.createBranch, VersioningController.createBranch);

router.get('/:configId/compare', authorize(['admin', 'editor', 'viewer']), VersioningController.compare);
router.post('/:configId/diff', authorize(['admin', 'editor', 'viewer']), validate.diff, VersioningController.diff);

router.get('/:configId/history', authorize(['admin', 'editor', 'viewer']), AuditController.getHistory);

module.exports = router;
