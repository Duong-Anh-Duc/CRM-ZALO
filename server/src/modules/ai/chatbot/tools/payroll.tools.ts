import prisma from '../../../../lib/prisma';
import { ToolDefinition } from '../types';

export const payrollTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_payroll_period',
        description: 'Tạo kỳ lương mới (year, month)',
        parameters: {
          type: 'object',
          properties: { year: { type: 'number' }, month: { type: 'number', description: '1-12' } },
          required: ['year', 'month'],
        },
      },
    },
    handler: async (args) => {
      const { PayrollService } = await import('../../../payroll/payroll.service');
      const p = await PayrollService.createPeriod(Number(args.year), Number(args.month));
      return `✅ Đã tạo kỳ lương ${args.month}/${args.year} [id:${p.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'calculate_payroll',
        description: 'Tính lương cho 1 kỳ (dựa vào công thức + nhân viên)',
        parameters: { type: 'object', properties: { period_id: { type: 'string' } }, required: ['period_id'] },
      },
    },
    handler: async (args) => {
      const { PayrollService } = await import('../../../payroll/payroll.service');
      const r = await PayrollService.calculatePeriod(args.period_id);
      return `✅ Đã tính lương kỳ [id:${args.period_id}] — ${r.calculated} nhân viên`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'approve_payroll',
        description: 'Duyệt kỳ lương đã tính',
        parameters: { type: 'object', properties: { period_id: { type: 'string' } }, required: ['period_id'] },
      },
    },
    handler: async (args) => {
      const { PayrollService } = await import('../../../payroll/payroll.service');
      await PayrollService.approvePeriod(args.period_id, 'chatbot');
      return `✅ Đã duyệt kỳ lương [id:${args.period_id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'mark_payroll_paid',
        description: 'Đánh dấu kỳ lương đã trả',
        parameters: { type: 'object', properties: { period_id: { type: 'string' } }, required: ['period_id'] },
      },
    },
    handler: async (args) => {
      const { PayrollService } = await import('../../../payroll/payroll.service');
      await PayrollService.markPaid(args.period_id);
      return `✅ Đã đánh dấu kỳ lương đã trả [id:${args.period_id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_employee_profile',
        description: 'Tạo hồ sơ nhân viên (payroll). Bắt buộc user_id (UUID của User đã tồn tại). Mỗi User chỉ có 1 profile.',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'UUID của User đã tồn tại' },
            base_salary: { type: 'number' },
            meal_allowance: { type: 'number' },
            phone_allowance: { type: 'number' },
            fuel_allowance: { type: 'number' },
            dependents: { type: 'number' },
            insurance_number: { type: 'string' },
            tax_code: { type: 'string' },
            bank_account: { type: 'string' },
            bank_name: { type: 'string' },
            employment_status: { type: 'string', enum: ['ACTIVE', 'PROBATION', 'INACTIVE'] },
            join_date: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['user_id'],
        },
      },
    },
    handler: async (args) => {
      const { PayrollService } = await import('../../../payroll/payroll.service');
      const p = await PayrollService.createEmployee(args);
      return `✅ Đã tạo hồ sơ NV "${(p as any).user?.full_name || ''}" [id:${p.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_employee_profile',
        description: 'Cập nhật hồ sơ nhân viên (id là EmployeeProfile id)',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            base_salary: { type: 'number' },
            meal_allowance: { type: 'number' },
            phone_allowance: { type: 'number' },
            fuel_allowance: { type: 'number' },
            dependents: { type: 'number' },
            insurance_number: { type: 'string' },
            tax_code: { type: 'string' },
            bank_account: { type: 'string' },
            bank_name: { type: 'string' },
            employment_status: { type: 'string', enum: ['ACTIVE', 'PROBATION', 'INACTIVE'] },
            join_date: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      const { PayrollService } = await import('../../../payroll/payroll.service');
      const { id, ...data } = args;
      if (data.join_date) data.join_date = new Date(data.join_date);
      const p = await PayrollService.updateEmployee(id, data);
      return `✅ Đã cập nhật hồ sơ NV "${(p as any).user?.full_name || ''}" [id:${p.id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_employee_profile',
        description: 'Nghỉ việc — đánh dấu employment_status = INACTIVE (soft delete)',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    handler: async (args) => {
      const p = await prisma.employeeProfile.update({
        where: { id: args.id },
        data: { employment_status: 'INACTIVE' },
      });
      return `✅ Đã đánh dấu NV nghỉ việc (INACTIVE) [id:${p.id}]`;
    },
  },
];
