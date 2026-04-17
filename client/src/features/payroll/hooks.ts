import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { payrollApi } from './api';

// ── Payroll Config ──
export const usePayrollConfig = () =>
  useQuery({
    queryKey: ['payroll-config'],
    queryFn: () => payrollApi.getConfig().then((r) => r.data),
  });

export const useUpdatePayrollConfig = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (data: any) => payrollApi.updateConfig(data),
    onSuccess: () => {
      message.success(t('payroll.configUpdated'));
      qc.invalidateQueries({ queryKey: ['payroll-config'] });
    },
  });
};

// ── Employee Profiles ──
export const useEmployeeProfiles = (params?: any) =>
  useQuery({
    queryKey: ['payroll-employees', params],
    queryFn: () => payrollApi.listEmployees(params).then((r) => r.data),
  });

export const useCreateEmployeeProfile = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (data: any) => payrollApi.createEmployee(data),
    onSuccess: () => {
      message.success(t('payroll.employeeCreated'));
      qc.invalidateQueries({ queryKey: ['payroll-employees'] });
    },
  });
};

export const useUpdateEmployeeProfile = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => payrollApi.updateEmployee(id, data),
    onSuccess: () => {
      message.success(t('payroll.employeeUpdated'));
      qc.invalidateQueries({ queryKey: ['payroll-employees'] });
    },
  });
};

// ── Payroll Periods ──
export const usePayrollPeriods = (params?: any) =>
  useQuery({
    queryKey: ['payroll-periods', params],
    queryFn: () => payrollApi.listPeriods(params).then((r) => r.data),
  });

export const useCreatePeriod = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (data: any) => payrollApi.createPeriod(data),
    onSuccess: () => {
      message.success(t('payroll.periodCreated'));
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
    },
  });
};

export const useDeletePeriod = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payrollApi.deletePeriod(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-periods'] }); },
  });
};

export const useCalculatePeriod = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => payrollApi.calculatePeriod(id),
    onSuccess: () => {
      message.success(t('payroll.periodCalculated'));
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
    },
  });
};

export const useApprovePeriod = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => payrollApi.approvePeriod(id),
    onSuccess: () => {
      message.success(t('payroll.periodApproved'));
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
    },
  });
};

export const usePayPeriod = () => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => payrollApi.payPeriod(id),
    onSuccess: () => {
      message.success(t('payroll.periodPaid'));
      qc.invalidateQueries({ queryKey: ['payroll-periods'] });
    },
  });
};

// ── Period Records & Payslip ──
export const usePeriodRecords = (periodId?: string) =>
  useQuery({
    queryKey: ['payroll-records', periodId],
    queryFn: () => payrollApi.getPeriodRecords(periodId!).then((r) => r.data),
    enabled: !!periodId,
  });

export const usePayslip = (periodId?: string, empId?: string) =>
  useQuery({
    queryKey: ['payslip', periodId, empId],
    queryFn: () => payrollApi.getPayslip(periodId!, empId!).then((r) => r.data),
    enabled: !!periodId && !!empId,
  });

export const usePeriodSummary = (periodId?: string) =>
  useQuery({
    queryKey: ['payroll-summary', periodId],
    queryFn: () => payrollApi.getPeriodSummary(periodId!).then((r) => r.data),
    enabled: !!periodId,
  });
