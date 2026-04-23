import React, { useEffect } from 'react';
import { Modal, Form, InputNumber, Select, Input, DatePicker } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useUsers } from '@/features/auth/hooks';
import { useCreateEmployeeProfile, useUpdateEmployeeProfile } from '../hooks';

interface Props {
  open: boolean;
  editingEmployee: any | null;
  existingUserIds: string[];
  onCancel: () => void;
  onSuccess: () => void;
}

const vndFormatter = (value: any) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const vndParser = (value: any) => value?.replace(/,/g, '') ?? '';

const EmployeeProfileFormModal: React.FC<Props> = ({
  open, editingEmployee, existingUserIds, onCancel, onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { data: usersData } = useUsers();
  const createMutation = useCreateEmployeeProfile();
  const updateMutation = useUpdateEmployeeProfile();

  const isEdit = !!editingEmployee;
  const users = (usersData as any)?.data ?? [];

  const availableUsers = isEdit
    ? users
    : users.filter((u: any) => !existingUserIds.includes(u.id));

  useEffect(() => {
    if (open && editingEmployee) {
      form.setFieldsValue({
        ...editingEmployee,
        user_id: editingEmployee.user_id ?? editingEmployee.user?.id,
        join_date: editingEmployee.join_date ? dayjs(editingEmployee.join_date) : undefined,
      });
    } else if (open) {
      form.resetFields();
    }
  }, [open, editingEmployee, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      join_date: values.join_date?.format('YYYY-MM-DD'),
    };

    if (isEdit) {
      await updateMutation.mutateAsync({ id: editingEmployee.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onSuccess();
  };

  const loading = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      title={isEdit ? t('payroll.editEmployee') : t('payroll.addEmployee')}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={Math.min(window.innerWidth * 0.95, 600)}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="user_id"
          label={t('payroll.selectUser')}
          rules={[{ required: true, message: t('payroll.selectUserRequired') }]}
        >
          <Select
            placeholder={t('payroll.selectUserPlaceholder')}
            disabled={isEdit}
            showSearch
            optionFilterProp="label"
            options={availableUsers.map((u: any) => ({
              value: u.id,
              label: `${u.full_name} (${u.email})`,
            }))}
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          name="base_salary"
          label={t('payroll.baseSalary')}
          rules={[{ required: true, message: t('payroll.baseSalaryRequired') }]}
        >
          <InputNumber
            style={{ width: '100%', borderRadius: 8 }}
            formatter={vndFormatter}
            parser={vndParser}
            addonAfter="VND"
            min={0}
          />
        </Form.Item>

        <Form.Item name="meal_allowance" label={t('payroll.mealAllowance')}>
          <InputNumber
            style={{ width: '100%', borderRadius: 8 }}
            formatter={vndFormatter}
            parser={vndParser}
            addonAfter="VND"
            min={0}
          />
        </Form.Item>

        <Form.Item name="phone_allowance" label={t('payroll.phoneAllowance')}>
          <InputNumber
            style={{ width: '100%', borderRadius: 8 }}
            formatter={vndFormatter}
            parser={vndParser}
            addonAfter="VND"
            min={0}
          />
        </Form.Item>

        <Form.Item name="fuel_allowance" label={t('payroll.fuelAllowance')}>
          <InputNumber
            style={{ width: '100%', borderRadius: 8 }}
            formatter={vndFormatter}
            parser={vndParser}
            addonAfter="VND"
            min={0}
          />
        </Form.Item>

        <Form.Item name="dependents" label={t('payroll.dependents')}>
          <InputNumber style={{ width: '100%', borderRadius: 8 }} min={0} max={20} />
        </Form.Item>

        <Form.Item
          name="employment_status"
          label={t('payroll.employmentStatus')}
          rules={[{ required: true }]}
          initialValue="ACTIVE"
        >
          <Select
            options={[
              { value: 'ACTIVE', label: t('payroll.statusActive') },
              { value: 'PROBATION', label: t('payroll.statusProbation') },
            ]}
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item name="insurance_number" label={t('payroll.insuranceNumber')}>
          <Input style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="tax_code" label={t('payroll.taxCode')}>
          <Input style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="bank_account" label={t('payroll.bankAccount')}>
          <Input style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="bank_name" label={t('payroll.bankName')}>
          <Input style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="join_date" label={t('payroll.joinDate')}>
          <DatePicker style={{ width: '100%', borderRadius: 8 }} format="DD/MM/YYYY" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EmployeeProfileFormModal;
