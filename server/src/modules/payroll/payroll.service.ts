import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { t } from '../../locales';
import { delCache } from '../../lib/redis';
import logger from '../../utils/logger';
import { calculatePayroll, PayrollConfigInput } from './payroll.calculator';

const DEFAULT_CONFIG: PayrollConfigInput = {
  base_salary_cap: 36000000, personal_deduction: 11000000, dependent_deduction: 4400000,
  bhxh_employee: 8, bhxh_employer: 17.5, bhyt_employee: 1.5, bhyt_employer: 3,
  bhtn_employee: 1, bhtn_employer: 1, meal_cap: 730000, phone_cap: 1000000, fuel_cap: 2000000,
};

export class PayrollService {
  // ── Config ──
  static async getConfig(): Promise<PayrollConfigInput> {
    const cfg = await prisma.payrollConfig.findFirst({ orderBy: { effective_from: 'desc' } });
    return cfg || DEFAULT_CONFIG;
  }

  static async updateConfig(data: Partial<PayrollConfigInput>) {
    const existing = await prisma.payrollConfig.findFirst({ orderBy: { effective_from: 'desc' } });
    if (existing) {
      return prisma.payrollConfig.update({ where: { id: existing.id }, data });
    }
    return prisma.payrollConfig.create({ data: { ...DEFAULT_CONFIG, ...data } });
  }

  // ── Employee Profiles ──
  static async listEmployees(filters: { page?: number; limit?: number; search?: string }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const where: any = {};
    if (filters.search) {
      where.user = { OR: [
        { full_name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ]};
    }

    const [data, total] = await Promise.all([
      prisma.employeeProfile.findMany({
        where, include: { user: { select: { id: true, full_name: true, email: true, role: true, is_active: true } } },
        skip: (page - 1) * limit, take: limit, orderBy: { created_at: 'desc' },
      }),
      prisma.employeeProfile.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  static async getEmployee(id: string) {
    const profile = await prisma.employeeProfile.findUnique({
      where: { id },
      include: { user: { select: { id: true, full_name: true, email: true, role: true } } },
    });
    if (!profile) throw new AppError(t('payroll.employeeNotFound'), 404);
    return profile;
  }

  static async createEmployee(data: any) {
    const existing = await prisma.employeeProfile.findUnique({ where: { user_id: data.user_id } });
    if (existing) throw new AppError(t('payroll.profileExists'), 400);
    return prisma.employeeProfile.create({
      data: {
        user_id: data.user_id,
        base_salary: data.base_salary || 0,
        meal_allowance: data.meal_allowance || 0,
        phone_allowance: data.phone_allowance || 0,
        fuel_allowance: data.fuel_allowance || 0,
        dependents: data.dependents || 0,
        insurance_number: data.insurance_number,
        tax_code: data.tax_code,
        bank_account: data.bank_account,
        bank_name: data.bank_name,
        employment_status: data.employment_status || 'ACTIVE',
        join_date: data.join_date ? new Date(data.join_date) : new Date(),
      },
      include: { user: { select: { full_name: true, email: true } } },
    });
  }

  static async updateEmployee(id: string, data: any) {
    const profile = await prisma.employeeProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError(t('payroll.employeeNotFound'), 404);
    return prisma.employeeProfile.update({ where: { id }, data, include: { user: { select: { full_name: true, email: true } } } });
  }

  // ── Periods ──
  static async listPeriods(filters: { page?: number; limit?: number }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const [data, total] = await Promise.all([
      prisma.payrollPeriod.findMany({
        include: { _count: { select: { records: true } } },
        skip: (page - 1) * limit, take: limit, orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      prisma.payrollPeriod.count(),
    ]);
    return { data, total, page, limit };
  }

  static async createPeriod(year: number, month: number, userId?: string) {
    const existing = await prisma.payrollPeriod.findUnique({ where: { year_month: { year, month } } });
    if (existing) throw new AppError(t('payroll.periodExists'), 400);
    return prisma.payrollPeriod.create({ data: { year, month, created_by: userId } });
  }

  static async deletePeriod(periodId: string) {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new AppError(t('payroll.periodNotFound'), 404);
    if (period.status === 'APPROVED' || period.status === 'PAID') {
      throw new AppError(t('payroll.cannotDelete'), 400);
    }
    await prisma.payrollRecord.deleteMany({ where: { period_id: periodId } });
    await prisma.payrollPeriod.delete({ where: { id: periodId } });
  }

  static async calculatePeriod(periodId: string) {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new AppError(t('payroll.periodNotFound'), 404);
    if (period.status !== 'DRAFT' && period.status !== 'CALCULATED') {
      throw new AppError(t('payroll.cannotCalculate'), 400);
    }

    const employees = await prisma.employeeProfile.findMany({
      where: { employment_status: { in: ['ACTIVE', 'PROBATION'] } },
      include: { user: { select: { is_active: true } } },
    });
    const config = await this.getConfig();

    // Delete old records if recalculating
    await prisma.payrollRecord.deleteMany({ where: { period_id: periodId } });

    const records = [];
    for (const emp of employees) {
      if (!emp.user.is_active) continue;

      const result = calculatePayroll({
        base_salary: emp.base_salary,
        meal_allowance: emp.meal_allowance,
        phone_allowance: emp.phone_allowance,
        fuel_allowance: emp.fuel_allowance,
        dependents: emp.dependents,
        employment_status: emp.employment_status,
      }, config);

      records.push(prisma.payrollRecord.create({
        data: {
          period_id: periodId,
          employee_id: emp.id,
          // Snapshot
          base_salary: emp.base_salary,
          meal_allowance: emp.meal_allowance,
          phone_allowance: emp.phone_allowance,
          fuel_allowance: emp.fuel_allowance,
          dependents: emp.dependents,
          employment_status: emp.employment_status,
          // Calculated
          ...result,
        },
      }));
    }

    await prisma.$transaction(records);
    await prisma.payrollPeriod.update({ where: { id: periodId }, data: { status: 'CALCULATED' } });

    return { calculated: records.length };
  }

  static async approvePeriod(periodId: string, userId: string) {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new AppError(t('payroll.periodNotFound'), 404);
    if (period.status !== 'CALCULATED') throw new AppError(t('payroll.cannotApprove'), 400);

    return prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: 'APPROVED', approved_by: userId, approved_at: new Date() },
    });
  }

  static async markPaid(periodId: string) {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId }, include: { records: true } });
    if (!period) throw new AppError(t('payroll.periodNotFound'), 404);
    if (period.status !== 'APPROVED') throw new AppError(t('payroll.cannotPay'), 400);

    const totalNet = period.records.reduce((s, r) => s + Number(r.net_salary), 0);
    const totalEmployerIns = period.records.reduce((s, r) => s + Number(r.total_insurance_employer), 0);

    // Update period status
    await prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: 'PAID', paid_at: new Date() },
    });

    // Auto create cash book entries
    try {
      const salaryCat = await prisma.cashCategory.findFirst({ where: { type: 'EXPENSE', name: { contains: 'ương' } } });
      if (salaryCat) {
        // Net salary expense
        await prisma.cashTransaction.create({
          data: {
            type: 'EXPENSE', category_id: salaryCat.id,
            date: new Date(), amount: totalNet,
            description: `Lương T${period.month}/${period.year} (${period.records.length} NV)`,
            payment_method: 'BANK_TRANSFER', is_auto: true,
          },
        });
        // Employer insurance expense
        if (totalEmployerIns > 0) {
          const insCat = await prisma.cashCategory.findFirst({ where: { type: 'EXPENSE', name: { contains: 'BH' } } });
          const catId = insCat?.id || salaryCat.id;
          await prisma.cashTransaction.create({
            data: {
              type: 'EXPENSE', category_id: catId,
              date: new Date(), amount: totalEmployerIns,
              description: `BHXH/BHYT/BHTN DN T${period.month}/${period.year}`,
              payment_method: 'BANK_TRANSFER', is_auto: true,
            },
          });
        }
      }
    } catch (err) { logger.warn(`Payroll cash sync failed: ${(err as Error).message}`); }

    await delCache('cache:/api/payroll*', 'cache:/api/cash-book*', 'cache:/api/dashboard*');
    return { total_net: totalNet, total_employer_insurance: totalEmployerIns, employees: period.records.length };
  }

  // ── Records ──
  static async getPeriodRecords(periodId: string) {
    return prisma.payrollRecord.findMany({
      where: { period_id: periodId },
      include: { employee: { include: { user: { select: { full_name: true, email: true } } } } },
      orderBy: { employee: { user: { full_name: 'asc' } } },
    });
  }

  static async getPayslip(periodId: string, employeeId: string) {
    const record = await prisma.payrollRecord.findUnique({
      where: { period_id_employee_id: { period_id: periodId, employee_id: employeeId } },
      include: {
        employee: { include: { user: { select: { full_name: true, email: true } } } },
        period: { select: { year: true, month: true } },
      },
    });
    if (!record) throw new AppError(t('payroll.recordNotFound'), 404);
    return record;
  }

  static async getPeriodSummary(periodId: string) {
    const records = await prisma.payrollRecord.findMany({ where: { period_id: periodId } });
    return {
      employee_count: records.length,
      total_gross: records.reduce((s, r) => s + Number(r.gross_salary), 0),
      total_insurance_employee: records.reduce((s, r) => s + Number(r.total_insurance_employee), 0),
      total_insurance_employer: records.reduce((s, r) => s + Number(r.total_insurance_employer), 0),
      total_pit: records.reduce((s, r) => s + Number(r.pit), 0),
      total_net: records.reduce((s, r) => s + Number(r.net_salary), 0),
    };
  }
}
