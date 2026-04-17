import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateIdParam } from '../../middleware/validate.middleware';
import { PayrollController } from './payroll.controller';

const router = Router();
router.use(authenticate);

// Config
router.get('/config', PayrollController.getConfig);
router.put('/config', requireRole('ADMIN'), PayrollController.updateConfig);

// Employee Profiles
router.get('/employees', PayrollController.listEmployees);
router.get('/employees/:id', validateIdParam, PayrollController.getEmployee);
router.post('/employees', requireRole('ADMIN'), PayrollController.createEmployee);
router.put('/employees/:id', validateIdParam, requireRole('ADMIN'), PayrollController.updateEmployee);

// Periods
router.get('/periods', PayrollController.listPeriods);
router.post('/periods', requireRole('ADMIN'), PayrollController.createPeriod);
router.delete('/periods/:id', validateIdParam, requireRole('ADMIN'), PayrollController.deletePeriod);
router.post('/periods/:id/calculate', validateIdParam, requireRole('ADMIN'), PayrollController.calculatePeriod);
router.post('/periods/:id/approve', validateIdParam, requireRole('ADMIN'), PayrollController.approvePeriod);
router.post('/periods/:id/pay', validateIdParam, requireRole('ADMIN'), PayrollController.markPaid);
router.get('/periods/:id/records', validateIdParam, PayrollController.getPeriodRecords);
router.get('/periods/:id/records/:empId', validateIdParam, PayrollController.getPayslip);
router.get('/periods/:id/summary', validateIdParam, PayrollController.getPeriodSummary);

export default router;
