import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validateIdParam } from '../../middleware/validate.middleware';
import { PayrollController } from './payroll.controller';

const router = Router();
router.use(authenticate);

// Config
router.get('/config', requireAbility('read', 'Payroll'), PayrollController.getConfig);
router.put('/config', requireAbility('manage', 'PayrollConfig'), PayrollController.updateConfig);

// Employee Profiles
router.get('/employees', requireAbility('read', 'Payroll'), PayrollController.listEmployees);
router.get('/employees/:id', validateIdParam, requireAbility('read', 'Payroll'), PayrollController.getEmployee);
router.post('/employees', requireAbility('manage', 'EmployeeProfile'), PayrollController.createEmployee);
router.put('/employees/:id', validateIdParam, requireAbility('manage', 'EmployeeProfile'), PayrollController.updateEmployee);

// Periods
router.get('/periods', requireAbility('read', 'Payroll'), PayrollController.listPeriods);
router.post('/periods', requireAbility('manage', 'PayrollPeriod'), PayrollController.createPeriod);
router.delete('/periods/:id', validateIdParam, requireAbility('manage', 'PayrollPeriod'), PayrollController.deletePeriod);
router.post('/periods/:id/calculate', validateIdParam, requireAbility('manage', 'PayrollPeriod'), PayrollController.calculatePeriod);
router.post('/periods/:id/approve', validateIdParam, requireAbility('manage', 'PayrollPeriod'), PayrollController.approvePeriod);
router.post('/periods/:id/pay', validateIdParam, requireAbility('manage', 'PayrollPeriod'), PayrollController.markPaid);
router.get('/periods/:id/records', validateIdParam, requireAbility('read', 'Payroll'), PayrollController.getPeriodRecords);
router.get('/periods/:id/records/:empId', validateIdParam, requireAbility('read', 'Payroll'), PayrollController.getPayslip);
router.get('/periods/:id/summary', validateIdParam, requireAbility('read', 'Payroll'), PayrollController.getPeriodSummary);

export default router;
