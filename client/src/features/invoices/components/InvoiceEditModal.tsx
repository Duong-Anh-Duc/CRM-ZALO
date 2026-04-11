import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Row, Col, Divider, Typography, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { useInvoice } from '../hooks';

const { Text } = Typography;

interface Props {
  invoiceId: string;
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}

const InvoiceEditModal: React.FC<Props> = ({ invoiceId, open, onClose, onSave, saving }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { data: invoiceData } = useInvoice(invoiceId);
  const invoice = invoiceData?.data;

  useEffect(() => {
    if (invoice) {
      form.setFieldsValue({
        seller_name: invoice.seller_name,
        seller_tax_code: invoice.seller_tax_code,
        seller_address: invoice.seller_address,
        seller_phone: invoice.seller_phone,
        seller_email: invoice.seller_email,
        seller_rep: invoice.seller_rep,
        seller_position: invoice.seller_position,
        buyer_name: invoice.buyer_name,
        buyer_company: invoice.buyer_company,
        buyer_address: invoice.buyer_address,
        buyer_tax_code: invoice.buyer_tax_code,
        buyer_email: invoice.buyer_email,
        buyer_payment: invoice.buyer_payment,
        vat_rate: invoice.vat_rate,
        notes: invoice.notes,
      });
    }
  }, [invoice, form]);

  const items = (invoice?.items || []) as any[];

  const handleSave = () => {
    const values = form.getFieldsValue();
    onSave(values);
  };

  const itemColumns = [
    { title: 'STT', key: 'stt', width: 50, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: t('invoice.itemName'), dataIndex: 'name', key: 'name' },
    { title: t('invoice.unit'), dataIndex: 'unit', key: 'unit', width: 70 },
    { title: t('invoice.quantity'), dataIndex: 'quantity', key: 'qty', width: 80 },
    { title: t('invoice.unitPrice'), dataIndex: 'unitPrice', key: 'price', width: 120, render: (v: number) => v?.toLocaleString('vi-VN') },
    { title: t('invoice.amount'), dataIndex: 'amount', key: 'amount', width: 120, render: (v: number) => v?.toLocaleString('vi-VN') },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      width={window.innerWidth < 640 ? '95vw' : 800}
      title={t('invoice.editDraft')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Divider orientation="left"><Text strong>{t('invoice.sellerInfo')}</Text></Divider>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="seller_name" label={t('invoice.companyName')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="seller_tax_code" label={t('invoice.taxCode')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="seller_address" label={t('invoice.address')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="seller_phone" label={t('invoice.phone')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="seller_rep" label={t('invoice.representative')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="seller_position" label={t('invoice.position')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left"><Text strong>{t('invoice.buyerInfo')}</Text></Divider>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="buyer_name" label={t('invoice.contactName')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="buyer_company" label={t('invoice.companyName')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="buyer_address" label={t('invoice.address')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="buyer_tax_code" label={t('invoice.taxCode')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="buyer_email" label="Email">
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="buyer_payment" label={t('invoice.paymentMethod')}>
              <Input style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left"><Text strong>{t('invoice.items')}</Text></Divider>
        <Table dataSource={items} columns={itemColumns} rowKey="name" pagination={false} size="small" scroll={{ x: 500 }} />

        <Row gutter={12} style={{ marginTop: 16 }}>
          <Col xs={24} md={8}>
            <Form.Item name="vat_rate" label={t('invoice.vatRate')}>
              <InputNumber min={0} max={20} addonAfter="%" style={{ width: '100%', borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="notes" label={t('invoice.notes')}>
              <Input.TextArea rows={2} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default InvoiceEditModal;
