import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { PayrollService } from './payroll.service';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response';

export class PayrollController {
  static async getConfig(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PayrollService.getConfig()); } catch (err) { next(err); }
  }
  static async updateConfig(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PayrollService.updateConfig(req.body)); } catch (err) { next(err); }
  }

  static async listEmployees(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PayrollService.listEmployees(req.query as never);
      sendPaginated(res, result.data, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) { next(err); }
  }
  static async getEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PayrollService.getEmployee(req.params.id as string)); } catch (err) { next(err); }
  }
  static async createEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendCreated(res, await PayrollService.createEmployee(req.body)); } catch (err) { next(err); }
  }
  static async updateEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PayrollService.updateEmployee(req.params.id as string, req.body)); } catch (err) { next(err); }
  }

  static async listPeriods(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PayrollService.listPeriods(req.query as never);
      sendPaginated(res, result.data, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) { next(err); }
  }
  static async createPeriod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendCreated(res, await PayrollService.createPeriod(req.body.year, req.body.month, req.user?.userId)); } catch (err) { next(err); }
  }
  static async deletePeriod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { await PayrollService.deletePeriod(req.params.id as string); sendSuccess(res, { deleted: true }); } catch (err) { next(err); }
  }
  static async calculatePeriod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PayrollService.calculatePeriod(req.params.id as string)); } catch (err) { next(err); }
  }
  static async approvePeriod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PayrollService.approvePeriod(req.params.id as string, req.user?.userId || '')); } catch (err) { next(err); }
  }
  static async markPaid(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PayrollService.markPaid(req.params.id as string)); } catch (err) { next(err); }
  }

  static async getPeriodRecords(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PayrollService.getPeriodRecords(req.params.id as string)); } catch (err) { next(err); }
  }
  static async getPayslip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PayrollService.getPayslip(req.params.id as string, req.params.empId as string)); } catch (err) { next(err); }
  }
  static async getPeriodSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await PayrollService.getPeriodSummary(req.params.id as string)); } catch (err) { next(err); }
  }
}
