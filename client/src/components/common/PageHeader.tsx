import React, { ReactNode } from 'react';
import { Typography, Flex } from 'antd';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, extra }) => (
  <Flex
    justify="space-between"
    align="center"
    style={{ marginBottom: 24 }}
  >
    <div>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      {subtitle && (
        <Typography.Text type="secondary" style={{ marginTop: 4, display: 'block' }}>
          {subtitle}
        </Typography.Text>
      )}
    </div>
    {extra && <Flex gap={8}>{extra}</Flex>}
  </Flex>
);

export default PageHeader;
