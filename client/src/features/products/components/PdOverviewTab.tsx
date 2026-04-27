import React from 'react';
import { useTranslation } from 'react-i18next';
import { materialLabels } from '@/utils/format';

const Spec: React.FC<{ label: string; value?: React.ReactNode; unit?: string }> = ({ label, value, unit }) => (
  <div className="pd-spec">
    <div className="pd-spec-label">{label}</div>
    <div className={`pd-spec-value${value == null || value === '' ? ' empty' : ''}`}>
      {value == null || value === '' ? <span>—</span> : <>{value}{unit && <span className="unit">{unit}</span>}</>}
    </div>
  </div>
);

const PackSpec: React.FC<{ label: string; value: React.ReactNode; unit?: string }> = ({ label, value, unit }) => (
  <div className="pd-pack-spec">
    <div className="pd-pack-spec-label">{label}</div>
    <div className="pd-pack-spec-value">{value}{unit && <span className="unit">{unit}</span>}</div>
  </div>
);

const BoxSvg: React.FC<{ length?: number | null; width?: number | null; height?: number | null }> = ({ length, width, height }) => (
  <svg width="180" height="160" viewBox="0 0 180 160">
    <defs>
      <linearGradient id="pd-boxFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#E8DFC8" /><stop offset="100%" stopColor="#C9BC9C" />
      </linearGradient>
      <linearGradient id="pd-boxTop" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F4ECD6" /><stop offset="100%" stopColor="#D9CCAA" />
      </linearGradient>
      <linearGradient id="pd-boxSide" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#B8AB89" /><stop offset="100%" stopColor="#9C8E6E" />
      </linearGradient>
    </defs>
    <polygon points="40,40 130,40 160,20 70,20" fill="url(#pd-boxTop)" stroke="#7A6E51" strokeWidth="0.8" />
    <polygon points="40,40 130,40 130,130 40,130" fill="url(#pd-boxFront)" stroke="#7A6E51" strokeWidth="0.8" />
    <polygon points="130,40 160,20 160,110 130,130" fill="url(#pd-boxSide)" stroke="#7A6E51" strokeWidth="0.8" />
    <line x1="85" y1="40" x2="85" y2="130" stroke="#7A6E51" strokeWidth="0.4" strokeDasharray="3 2" opacity="0.6" />
    {length && (<>
      <line x1="40" y1="140" x2="130" y2="140" stroke="#1A1A1A" strokeWidth="0.5" />
      <text x="85" y="152" textAnchor="middle" fontFamily="Geist Mono" fontSize="9" fill="#1A1A1A">{length}mm</text>
    </>)}
    {height && (<>
      <line x1="170" y1="20" x2="170" y2="110" stroke="#1A1A1A" strokeWidth="0.5" />
      <text x="174" y="68" fontFamily="Geist Mono" fontSize="9" fill="#1A1A1A">{height}</text>
    </>)}
    {width && (<>
      <line x1="30" y1="40" x2="30" y2="130" stroke="#1A1A1A" strokeWidth="0.5" />
      <text x="20" y="88" textAnchor="end" fontFamily="Geist Mono" fontSize="9" fill="#1A1A1A">{width}</text>
    </>)}
  </svg>
);

const PdOverviewTab: React.FC<{ product: any }> = ({ product }) => {
  const { t } = useTranslation();
  const colorVal = product.color
    ? t(`colorLabels.${product.color}`) + (product.custom_color ? ` (${product.custom_color})` : '')
    : null;
  const shape = product.shape ? t(`shapeLabels.${product.shape}`) : null;
  const neck = product.neck_type
    ? t(`neckLabels.${product.neck_type}`) + (product.neck_spec ? ` · ${product.neck_spec}` : '')
    : null;

  const specs: { label: string; value?: React.ReactNode; unit?: string }[] = [
    { label: t('product.material'), value: product.material ? materialLabels[product.material] : null },
    { label: t('product.color'), value: colorVal },
    { label: t('product.weight'), value: product.weight_g, unit: 'g' },
    { label: t('product.capacity'), value: product.capacity_ml, unit: 'ml' },
    { label: t('product.height'), value: product.height_mm, unit: 'mm' },
    { label: t('product.bodyDiameter'), value: product.body_dia_mm, unit: 'mm' },
    { label: t('product.neckDiameter'), value: product.neck_dia_mm, unit: 'mm' },
    { label: t('product.shape'), value: shape },
    { label: t('product.neckType'), value: neck },
  ];
  const filledSpecs = specs.filter(s => s.value != null && s.value !== '').length;

  const len = product.carton_length;
  const wid = product.carton_width;
  const hgt = product.carton_height;
  const volumeL = (len && wid && hgt) ? Math.round((len * wid * hgt) / 1000) / 1000 : null;

  const safetyDescriptions: Record<string, string> = {
    FDA_FOOD_GRADE: t('product.safetyDescFDA'),
    BPA_FREE: t('product.safetyDescBPA'),
    ISO: t('product.safetyDescISO'),
  };

  return (
    <>
      <section className="pd-section">
        <div className="pd-section-header">
          <h2 className="pd-section-title"><span className="num">01</span> {t('product.technicalSpecs')}</h2>
          <span className="pd-section-meta">{t('product.fieldsFilledOf', { filled: filledSpecs, total: specs.length })}</span>
        </div>
        <div className="pd-spec-grid">
          {specs.map((s, i) => <Spec key={i} {...s} />)}
        </div>
      </section>

      <section className="pd-section">
        <div className="pd-section-header">
          <h2 className="pd-section-title"><span className="num">02</span> {t('product.packaging')}</h2>
          {len && wid && hgt && <span className="pd-section-meta">{t('product.cartonStandard')}</span>}
        </div>
        <div className="pd-pack-wrap">
          <div className="pd-box-visual">
            <BoxSvg length={len} width={wid} height={hgt} />
            <div className="pd-box-title">{t('product.cartonSize')}</div>
            <div className="pd-box-dims">{len ?? '—'} × {wid ?? '—'} × {hgt ?? '—'} mm</div>
            <div className="pd-box-meta">
              {product.carton_weight && <span>{t('product.weight')} <strong>{product.carton_weight}kg</strong></span>}
              {volumeL && <span>{t('product.volume')} <strong>{volumeL.toLocaleString('vi')}L</strong></span>}
            </div>
          </div>
          <div className="pd-pack-specs">
            <PackSpec label={t('product.unitOfSale')} value={t(`unitLabels.${product.unit_of_sale}`)} />
            <PackSpec label={t('product.pcsPerCarton')} value={product.pcs_per_carton ? Number(product.pcs_per_carton).toLocaleString('vi') : '—'} />
            <PackSpec label={t('product.moq')} value={product.moq ? Number(product.moq).toLocaleString('vi') : '—'} unit={product.moq ? t(`unitLabels.${product.unit_of_sale}`) : undefined} />
            <PackSpec label={t('product.cartonLength')} value={len ?? '—'} unit={len ? 'mm' : undefined} />
            <PackSpec label={t('product.cartonWidth')} value={wid ?? '—'} unit={wid ? 'mm' : undefined} />
            <PackSpec label={t('product.cartonHeight')} value={hgt ?? '—'} unit={hgt ? 'mm' : undefined} />
          </div>
        </div>
      </section>

      <section className="pd-section">
        <div className="pd-section-header">
          <h2 className="pd-section-title"><span className="num">03</span> {t('product.applicationStandards')}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div className="pd-spec-label" style={{ marginBottom: 10 }}>{t('product.industries')}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(product.industries || []).length > 0
                ? product.industries.map((ind: string) => <span key={ind} className="pd-tag">{t(`industryLabels.${ind}`)}</span>)
                : <span className="pd-spec-value empty">—</span>}
            </div>
          </div>
          <div>
            <div className="pd-spec-label" style={{ marginBottom: 10 }}>{t('product.safetyStandards')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(product.safety_standards || []).length > 0
                ? product.safety_standards.map((s: string) => (
                    <div key={s} className="pd-std-card">
                      <div className="pd-std-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4" /><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></svg>
                      </div>
                      <div>
                        <div className="pd-std-title">{t(`safetyLabels.${s}`)}</div>
                        <div className="pd-std-desc">{safetyDescriptions[s] || ''}</div>
                      </div>
                    </div>
                  ))
                : <span className="pd-spec-value empty">—</span>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default PdOverviewTab;
