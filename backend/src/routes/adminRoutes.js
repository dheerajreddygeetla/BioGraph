const express = require('express');
const { getMetrics, getAuditLogs } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const auditLog = require('../middleware/auditLogger');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect, authorize('admin'));

// Get metrics – log admin action
router.get('/metrics', auditLog('ADMIN_ACTION', '/api/admin/metrics'), getMetrics);
router.get('/logs', auditLog('ADMIN_ACTION', '/api/admin/logs'), getAuditLogs);

module.exports = router;