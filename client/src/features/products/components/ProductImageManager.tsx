import React, { useState } from 'react';
import { Upload, Image, Button, Space, Popconfirm, Tag, Empty, Spin } from 'antd';
import {
  PlusOutlined, DeleteOutlined, StarOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUploadProductImages, useDeleteProductImage, useSetPrimaryImage } from '../hooks';
import { ProductImageManagerProps } from '../types';

const ProductImageManager: React.FC<ProductImageManagerProps> = ({ productId, images, canManage }) => {
  const { t } = useTranslation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const uploadMutation = useUploadProductImages();
  const deleteMutation = useDeleteProductImage();
  const primaryMutation = useSetPrimaryImage();

  const handleUpload = (info: { fileList: UploadFile[] }) => {
    const files = info.fileList
      .filter((f) => f.originFileObj)
      .map((f) => f.originFileObj!);

    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    uploadMutation.mutate({ productId, files: formData });
  };

  const isLoading = uploadMutation.isPending || deleteMutation.isPending || primaryMutation.isPending;

  return (
    <div>
      {images.length === 0 && !canManage && (
        <Empty description={t('product.noImages')} />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        {images.map((img) => (
          <div
            key={img.id}
            style={{
              position: 'relative',
              width: 140,
              height: 140,
              borderRadius: 12,
              overflow: 'hidden',
              border: img.is_primary ? '2px solid #1677ff' : '1px solid #d9d9d9',
            }}
          >
            <Image
              src={img.url}
              alt=""
              width={140}
              height={140}
              style={{ objectFit: 'cover', cursor: 'pointer' }}
              preview={{
                visible: previewOpen && previewUrl === img.url,
                onVisibleChange: (v) => {
                  setPreviewOpen(v);
                  if (v) setPreviewUrl(img.url);
                },
              }}
              onClick={() => {
                setPreviewUrl(img.url);
                setPreviewOpen(true);
              }}
            />

            {img.is_primary && (
              <Tag
                color="blue"
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  borderRadius: 6,
                  fontSize: 11,
                  margin: 0,
                }}
              >
                {t('product.primary')}
              </Tag>
            )}

            {canManage && (
              <Space
                size={4}
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                }}
              >
                {!img.is_primary && (
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<StarOutlined />}
                    onClick={() => primaryMutation.mutate({ productId, imageId: img.id })}
                    loading={primaryMutation.isPending}
                    style={{ borderRadius: 6, background: 'rgba(255,255,255,0.9)' }}
                  />
                )}
                <Popconfirm
                  title={t('product.deleteImageConfirm')}
                  onConfirm={() => deleteMutation.mutate({ productId, imageId: img.id })}
                  okText={t('common.delete')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteMutation.isPending}
                    style={{ borderRadius: 6, background: 'rgba(255,255,255,0.9)' }}
                  />
                </Popconfirm>
              </Space>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <Upload
          multiple
          accept="image/jpeg,image/png,image/webp"
          showUploadList={false}
          beforeUpload={() => false}
          onChange={handleUpload}
          disabled={isLoading}
        >
          <Button
            icon={isLoading ? <Spin size="small" /> : <PlusOutlined />}
            style={{ borderRadius: 8 }}
            loading={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? t('product.uploading') : t('product.uploadImages')}
          </Button>
        </Upload>
      )}

      {canManage && (
        <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
          {t('product.uploadHint')}
        </div>
      )}
    </div>
  );
};

export default ProductImageManager;
