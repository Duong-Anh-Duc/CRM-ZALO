import React from 'react';
import { Modal, Descriptions, Spin, Typography, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatVND } from '@/utils/format';
import { usePayslip } from '../hooks';

const { Text, Title } = Typography;

interface Props {
  open: boolean;
  periodId?: string;
  employeeId?: string;
  periodLabel?: string;
  onCancel: () => void;
}

const PayslipModal: React.FC<Props> = ({ open, periodId, employeeId, periodLabel, onCancel }) => {
  const { t } = useTranslation();
  const { data: payslipData, isLoading } = usePayslip(
    open ? periodId : undefined,
    open ? employeeId : undefined,
  );

  const record = (payslipData as any)?.data;

  const gross = (record?.base_salary ?? 0)
    + (record?.meal_allowance ?? 0)
    + (record?.phone_allowance ?? 0)
    + (record?.fuel_allowance ?? 0);

  const totalInsEmployee = (record?.social_insurance_employee ?? 0)
    + (record?.health_insurance_employee ?? 0)
    + (record?.unemployment_insurance_employee ?? 0);

  const personalDeduction = record?.personal_deduction ?? 11_000_000;
  const dependentDeduction = record?.dependent_deduction ?? 0;
  const totalDeduction = personalDeduction + dependentDeduction;

  const taxableIncome = record?.taxable_income ?? 0;
  const pit = record?.personal_income_tax ?? 0;
  const netSalary = record?.net_salary ?? 0;

  const totalInsEmployer = (record?.social_insurance_employer ?? 0)
    + (record?.health_insurance_employer ?? 0)
    + (record?.unemployment_insurance_employer ?? 0);

  const employeeName = record?.employee?.user?.full_name ?? record?.employee_name ?? '';

  return (
    <Modal
      open={open}
      title={t('payroll.payslipTitle')}
      onCancel={onCancel}
      footer={null}
      width={Math.min(window.innerWidth * 0.95, 640)}
      destroyOnClose
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : !record ? (
        <Text type="secondary">{t('common.noData')}</Text>
      ) : (
        <div>
          <Row justify="space-between" style={{ marginBottom: 16 }}>
            <Col>
              <Text strong>{t('payroll.employee')}: </Text>
              <Text>{employeeName}</Text>
            </Col>
            <Col>
              <Text strong>{t('payroll.period')}: </Text>
              <Text>{periodLabel}</Text>
            </Col>
          </Row>

          {/* Section 1: Income */}
          <Descriptions
            title={t('payroll.sectionIncome')}
            column={1}
            size="small"
            bordered
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label={t('payroll.baseSalary')}>
              {formatVND(record.base_salary)}
            </Descriptions.Item>
            <Descriptions.Item label={t('payroll.mealAllowance')}>
              {formatVND(record.meal_allowance)}
            </Descriptions.Item>
            <Descriptions.Item label={t('payroll.phoneAllowance')}>
              {formatVND(record.phone_allowance)}
            </Descriptions.Item>
            <Descriptions.Item label={t('payroll.fuelAllowance')}>
              {formatVND(record.fuel_allowance)}
            </Descriptions.Item>
            <Descriptions.Item label={<Text strong>{t('payroll.grossSalary')}</Text>}>
              <Text strong>{formatVND(gross)}</Text>
            </Descriptions.Item>
          </Descriptions>

          {/* Section 2: Employee Insurance */}
          <Descriptions
            title={t('payroll.sectionInsurance')}
            column={1}
            size="small"
            bordered
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label={t('payroll.socialInsurance8')}>
              {formatVND(record.social_insurance_employee)}
            </Descriptions.Item>
            <Descriptions.Item label={t('payroll.healthInsurance15')}>
              {formatVND(record.health_insurance_employee)}
            </Descriptions.Item>
            <Descriptions.Item label={t('payroll.unemploymentInsurance1')}>
              {formatVND(record.unemployment_insurance_employee)}
            </Descriptions.Item>
            <Descriptions.Item label={<Text strong>{t('payroll.totalInsEmployee')}</Text>}>
              <Text strong>{formatVND(totalInsEmployee)}</Text>
            </Descriptions.Item>
          </Descriptions>

          {/* Section 3: Deductions */}
          <Descriptions
            title={t('payroll.sectionDeductions')}
            column={1}
            size="small"
            bordered
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label={t('payroll.personalDeductionLabel')}>
              {formatVND(personalDeduction)}
            </Descriptions.Item>
            <Descriptions.Item label={t('payroll.dependentDeduction')}>
              {formatVND(dependentDeduction)}
            </Descriptions.Item>
            <Descriptions.Item label={<Text strong>{t('payroll.totalDeduction')}</Text>}>
              <Text strong>{formatVND(totalDeduction)}</Text>
            </Descriptions.Item>
          </Descriptions>

          {/* Section 4: Tax */}
          <Descriptions
            title={t('payroll.sectionTax')}
            column={1}
            size="small"
            bordered
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label={t('payroll.taxableIncome')}>
              {formatVND(taxableIncome)}
            </Descriptions.Item>
            <Descriptions.Item label={<Text strong>{t('payroll.personalIncomeTax')}</Text>}>
              <Text strong style={{ color: '#cf1322' }}>{formatVND(pit)}</Text>
            </Descriptions.Item>
          </Descriptions>

          {/* Section 5: Net Salary */}
          <div
            style={{
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 12,
              padding: '16px 24px',
              textAlign: 'center',
              marginBottom: 16,
            }}
          >
            <Text type="secondary">{t('payroll.netSalaryLabel')}</Text>
            <Title level={3} style={{ color: '#52c41a', margin: '4px 0 0' }}>
              {formatVND(netSalary)}
            </Title>
          </div>

          {/* Section 6: Employer Insurance */}
          <Descriptions
            title={t('payroll.sectionEmployerInsurance')}
            column={1}
            size="small"
            bordered
          >
            <Descriptions.Item label={t('payroll.socialInsuranceEmployer')}>
              {formatVND(record.social_insurance_employer)}
            </Descriptions.Item>
            <Descriptions.Item label={t('payroll.healthInsuranceEmployer')}>
              {formatVND(record.health_insurance_employer)}
            </Descriptions.Item>
            <Descriptions.Item label={t('payroll.unemploymentInsuranceEmployer')}>
              {formatVND(record.unemployment_insurance_employer)}
            </Descriptions.Item>
            <Descriptions.Item label={<Text strong>{t('payroll.totalInsEmployer')}</Text>}>
              <Text strong>{formatVND(totalInsEmployer)}</Text>
            </Descriptions.Item>
          </Descriptions>
        </div>
      )}
    </Modal>
  );
};

export default PayslipModal;
