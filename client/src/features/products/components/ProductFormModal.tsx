import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, Tabs, Button, Space, Upload, Divider,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useCreateProduct, useUpdateProduct } from '../hooks';
import { productApi } from '../api';
import { Category } from '@/types';
import ProductImageManager from './ProductImageManager';
import { ProductFormModalProps } from '../types';

const opt = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
const materialOptions = opt([['PET','PET'],['HDPE','HDPE'],['PP','PP'],['PVC','PVC'],['PS','PS'],['ABS','ABS']]);

const fieldStyle: React.CSSProperties = { borderRadius: 8 };

const ProductFormModal: React.FC<ProductFormModalProps> = ({ open, product, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const isEdit = !!product;

  const colorOptions = useMemo(() => opt([['TRANSPARENT', t('colorLabels.TRANSPARENT')],['WHITE', t('colorLabels.WHITE')],['CUSTOM', t('colorLabels.CUSTOM')]]), [t]);
  const shapeOptions = useMemo(() => opt([['ROUND', t('shapeLabels.ROUND')],['SQUARE', t('shapeLabels.SQUARE')],['OVAL', t('shapeLabels.OVAL')],['FLAT', t('shapeLabels.FLAT')]]), [t]);
  const neckOptions = useMemo(() => opt([['WIDE', t('neckLabels.WIDE')],['NARROW', t('neckLabels.NARROW')],['PUMP', t('neckLabels.PUMP')],['SPRAY', t('neckLabels.SPRAY')],['SCREW', t('neckLabels.SCREW')]]), [t]);
  const unitOptions = useMemo(() => opt([['PIECE', t('unitLabels.PIECE')],['CARTON', t('unitLabels.CARTON')],['KG', t('unitLabels.KG')]]), [t]);
  const industryOptions = useMemo(() => opt([['FOOD', t('industryLabels.FOOD')],['COSMETICS', t('industryLabels.COSMETICS')],['CHEMICAL', t('industryLabels.CHEMICAL')],['PHARMA', t('industryLabels.PHARMA')],['HOUSEHOLD', t('industryLabels.HOUSEHOLD')]]), [t]);
  const safetyOptions = useMemo(() => opt([['FDA_FOOD_GRADE', t('safetyLabels.FDA_FOOD_GRADE')],['BPA_FREE', t('safetyLabels.BPA_FREE')],['ISO', t('safetyLabels.ISO')]]), [t]);

  useEffect(() => {
    if (open) {
      if (product) {
        form.setFieldsValue({
          ...product,
          category_id: product.category_id,
          price_tiers: product.price_tiers?.length ? product.price_tiers : [],
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ is_active: true, industries: [], safety_standards: [], price_tiers: [] });
      }
    }
  }, [open, product, form]);

  const { data: categoriesData } = useQuery<Category[]>({
    queryKey: ['product-categories'],
    queryFn: () => productApi.list({ type: 'categories' }).then((r) => r.data.data ?? []),
  });
  const categoryOptions = (categoriesData ?? []).map((c: Category) => ({ value: c.id, label: c.name }));

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const loading = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit) {
        updateMutation.mutate({ id: product!.id, data: values }, { onSuccess: () => onSuccess() });
      } else {
        const formData = new FormData();
        Object.entries(values).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          if (key === 'price_tiers' || key === 'industries' || key === 'safety_standards') {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        });
        fileList.forEach((file) => {
          if (file.originFileObj) formData.append('images', file.originFileObj);
        });
        createMutation.mutate(formData, { onSuccess: () => { setFileList([]); onSuccess(); } });
      }
    } catch {
      // validation error
    }
  };

  const tabItems = [
    {
      key: 'general',
      label: t('product.generalInfo'),
      children: (
        <>
          <Form.Item name="name" label={t('product.name')} rules={[{ required: true, message: t('product.nameRequired') }]}>
            <Input style={fieldStyle} />
          </Form.Item>
          <Form.Item name="category_id" label={t('product.category')}>
            <Select popupMatchSelectWidth={false} allowClear showSearch optionFilterProp="label" style={fieldStyle} placeholder={t('product.selectCategory')} options={categoryOptions} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={3} style={fieldStyle} />
          </Form.Item>
          <Form.Item name="is_active" label={t('common.status')} initialValue={true}>
            <Select popupMatchSelectWidth={false}
              style={fieldStyle}
              options={[
                { value: true, label: t('common.active') },
                { value: false, label: t('common.inactive') },
              ]}
            />
          </Form.Item>

          <Divider style={{ margin: '16px 0' }}>{t('product.pricing')}</Divider>

          <Form.Item name="retail_price" label={t('product.retailPriceVnd')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v: string | undefined) => v ? Number(v.replace(/\./g, '')) : 0} />
          </Form.Item>
          <Form.Item label={t('product.priceTiers')}>
            <Form.List name="price_tiers">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item {...rest} name={[name, 'min_qty']} rules={[{ required: true, message: t('product.minQtyRequired') }]}>
                        <InputNumber placeholder={t('product.minQty')} min={1} style={{ ...fieldStyle, width: 160 }} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'price']} rules={[{ required: true, message: t('product.priceRequired') }]}>
                        <InputNumber
                          placeholder={t('product.unitPriceVnd')}
                          min={0}
                          style={{ ...fieldStyle, width: 200 }}
                          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                          parser={(v: string | undefined) => v ? Number(v.replace(/\./g, '')) : 0}
                        />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} style={{ borderRadius: 8 }}>
                    {t('product.addPriceTier')}
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Divider style={{ margin: '16px 0' }}>{t('product.images')}</Divider>

          <Form.Item label={t('product.images')}>
            {isEdit ? (
              <ProductImageManager productId={product!.id} images={product!.images || []} canManage={true} />
            ) : (
              <Upload
                listType="picture-card"
                fileList={fileList}
                onChange={({ fileList: newList }) => setFileList(newList)}
                beforeUpload={() => false}
                accept="image/jpeg,image/png,image/webp"
                multiple
              >
                {fileList.length < 10 && (
                  <div><PlusOutlined /><div style={{ marginTop: 8 }}>{t('product.uploadImages')}</div></div>
                )}
              </Upload>
            )}
          </Form.Item>
        </>
      ),
    },
    {
      key: 'specs',
      label: t('product.technicalSpecs'),
      children: (
        <>
          <Form.Item name="material" label={t('product.material')}>
            <Select popupMatchSelectWidth={false} allowClear options={materialOptions} style={fieldStyle} placeholder={t('product.selectMaterial')} />
          </Form.Item>
          <Form.Item name="capacity_ml" label={t('product.capacityMl')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
          <Form.Item name="height_mm" label={t('product.heightMm')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
          <Form.Item name="body_dia_mm" label={t('product.bodyDiaMm')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
          <Form.Item name="neck_dia_mm" label={t('product.neckDiaMm')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
          <Form.Item name="weight_g" label={t('product.weightG')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
          <Form.Item name="color" label={t('product.color')}>
            <Select popupMatchSelectWidth={false} allowClear options={colorOptions} style={fieldStyle} placeholder={t('product.selectColor')} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.color !== cur.color}>
            {({ getFieldValue }) =>
              getFieldValue('color') === 'CUSTOM' ? (
                <Form.Item name="custom_color" label={t('product.customColor')}>
                  <Input style={fieldStyle} placeholder={t('product.customColorPlaceholder')} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="shape" label={t('product.shape')}>
            <Select popupMatchSelectWidth={false} allowClear options={shapeOptions} style={fieldStyle} placeholder={t('product.selectShape')} />
          </Form.Item>
          <Form.Item name="neck_type" label={t('product.neckType')}>
            <Select popupMatchSelectWidth={false} allowClear options={neckOptions} style={fieldStyle} placeholder={t('product.selectNeckType')} />
          </Form.Item>
          <Form.Item name="neck_spec" label={t('product.neckSpec')}>
            <Input style={fieldStyle} placeholder={t('product.neckSpecPlaceholder')} />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'packaging',
      label: t('product.packaging'),
      children: (
        <>
          <Form.Item name="unit_of_sale" label={t('product.unitOfSale')}>
            <Select popupMatchSelectWidth={false} allowClear options={unitOptions} style={fieldStyle} placeholder={t('product.selectUnit')} />
          </Form.Item>
          <Form.Item name="pcs_per_carton" label={t('product.pcsPerCarton')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
          <Form.Item name="carton_weight" label={t('product.cartonWeight')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
          <Form.Item name="carton_length" label={t('product.cartonLength')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
          <Form.Item name="carton_width" label={t('product.cartonWidth')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
          <Form.Item name="carton_height" label={t('product.cartonHeight')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
          <Form.Item name="moq" label={t('product.moq')}>
            <InputNumber min={0} style={{ ...fieldStyle, width: '100%' }} />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'application',
      label: t('product.application'),
      children: (
        <>
          <Form.Item name="industries" label={t('product.industries')}>
            <Select popupMatchSelectWidth={false} mode="multiple" options={industryOptions} style={fieldStyle} placeholder={t('product.selectIndustry')} />
          </Form.Item>
          <Form.Item name="safety_standards" label={t('product.safetyStandards')}>
            <Select popupMatchSelectWidth={false} mode="multiple" options={safetyOptions} style={fieldStyle} placeholder={t('product.selectSafety')} />
          </Form.Item>
        </>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={isEdit ? t('product.editProduct') : t('product.addNewProduct')}
      width={Math.min(window.innerWidth * 0.95, 720)}
      onCancel={onClose}
      destroyOnClose
      styles={{ body: { borderRadius: 12 } }}
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 8 }}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" loading={loading} onClick={handleSubmit} style={{ borderRadius: 8 }}>
            {isEdit ? t('common.update') : t('common.create')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Tabs items={tabItems} />
      </Form>
    </Modal>
  );
};

export default ProductFormModal;
