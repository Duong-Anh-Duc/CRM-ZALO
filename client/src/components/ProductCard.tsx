import React from 'react';
import { Button, theme, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export interface ProductCard {
  id: string;
  sku: string;
  name: string;
  material?: string;
  capacity_ml?: number;
  price?: number;
  image?: string;
  moq?: number;
}

interface ProductCardItemProps {
  card: ProductCard;
  onNavigate: () => void;
}

const PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="%23f0f0f0"/><text x="40" y="46" font-size="10" fill="%23999" text-anchor="middle" font-family="Arial">No image</text></svg>';

const ProductCardItem: React.FC<ProductCardItemProps> = ({ card, onNavigate }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  const specs: string[] = [];
  if (card.capacity_ml) specs.push(`${card.capacity_ml}ml`);
  if (card.material) specs.push(card.material);
  const specStr = specs.join(' · ');

  const priceStr = card.price != null ? `~${Math.round(card.price).toLocaleString()}đ` : null;
  const moqStr = card.moq != null ? t('chatbot.productCard.moq', { n: card.moq }) : null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: 10,
        borderRadius: 12,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        alignItems: 'stretch',
      }}
    >
      <img
        src={card.image || PLACEHOLDER}
        alt={card.name}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = PLACEHOLDER;
        }}
        style={{
          width: 80,
          height: 80,
          borderRadius: 10,
          objectFit: 'cover',
          background: '#f5f5f5',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Text strong style={{ fontSize: 13, lineHeight: 1.3, color: token.colorText }}>
          {card.name}
        </Text>
        <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
          SKU {card.sku}
          {specStr ? ` · ${specStr}` : ''}
        </Text>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {priceStr && (
            <Text style={{ fontSize: 12, color: token.colorPrimary, fontWeight: 600 }}>
              {priceStr}
            </Text>
          )}
          {moqStr && (
            <Text style={{ fontSize: 11, color: token.colorTextSecondary }}>
              · {moqStr}
            </Text>
          )}
        </div>
        <div style={{ marginTop: 4 }}>
          <Button
            size="small"
            type="link"
            icon={<ArrowRightOutlined />}
            onClick={onNavigate}
            style={{
              padding: 0,
              fontSize: 12,
              height: 'auto',
              color: token.colorPrimary,
            }}
          >
            {t('chatbot.productCard.viewDetail')}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface ProductCardListProps {
  cards: ProductCard[];
  onSelect: (id: string) => void;
  maxItems?: number;
}

export const ProductCardList: React.FC<ProductCardListProps> = ({ cards, onSelect, maxItems = 5 }) => {
  if (!cards.length) return null;
  const shown = cards.slice(0, maxItems);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, marginLeft: 28 }}>
      {shown.map((c) => (
        <ProductCardItem key={c.id} card={c} onNavigate={() => onSelect(c.id)} />
      ))}
    </div>
  );
};

export default ProductCardList;
