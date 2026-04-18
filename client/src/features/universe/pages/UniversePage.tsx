import React, { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Billboard, Html } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useNavigate } from 'react-router-dom';
import { Switch, Button, Spin, Space } from 'antd';
import {
  ArrowLeftOutlined, ReloadOutlined, DragOutlined, ExpandAltOutlined,
  ShoppingOutlined, TeamOutlined, ShopOutlined, FileTextOutlined, ImportOutlined,
  DollarOutlined, WalletOutlined, FilePdfOutlined, BankOutlined, BarChartOutlined,
  BellOutlined, RobotOutlined, GlobalOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { formatVND } from '@/utils/format';
import * as THREE from 'three';

interface ModuleNode {
  id: string;
  name: string;
  Icon: React.ComponentType<any>;
  color: string;
  path: string;
  metricLabel: string;
  metric: string | number;
  radius: number; angle: number; speed: number; size: number; elev: number;
}

// Pastel colors matching the reference (frosted planet look)
const MODULES_META: Array<Omit<ModuleNode, 'radius' | 'angle' | 'speed' | 'size' | 'elev' | 'metric' | 'metricLabel'>> = [
  { id: 'products', name: 'Sản phẩm', Icon: ShoppingOutlined, color: '#ffb78a', path: '/products' },
  { id: 'customers', name: 'Khách hàng', Icon: TeamOutlined, color: '#86efac', path: '/customers' },
  { id: 'suppliers', name: 'Nhà cung cấp', Icon: ShopOutlined, color: '#c4b5fd', path: '/suppliers' },
  { id: 'sales-orders', name: 'Đơn bán', Icon: FileTextOutlined, color: '#93c5fd', path: '/sales-orders' },
  { id: 'purchase-orders', name: 'Đơn mua', Icon: ImportOutlined, color: '#fca5a5', path: '/purchase-orders' },
  { id: 'debts', name: 'Công nợ', Icon: DollarOutlined, color: '#fde68a', path: '/debts' },
  { id: 'cash-book', name: 'Sổ quỹ', Icon: WalletOutlined, color: '#99f6e4', path: '/cash-book' },
  { id: 'invoices', name: 'Hóa đơn', Icon: FilePdfOutlined, color: '#a5b4fc', path: '/sales-orders' },
  { id: 'payroll', name: 'Lương', Icon: BankOutlined, color: '#f9a8d4', path: '/payroll' },
  { id: 'reports', name: 'Báo cáo', Icon: BarChartOutlined, color: '#d1d5db', path: '/reports' },
  { id: 'alerts', name: 'Cảnh báo', Icon: BellOutlined, color: '#fdba74', path: '/alerts' },
  { id: 'aura', name: 'Aura AI', Icon: RobotOutlined, color: '#e9d5ff', path: '/' },
];

const CONNECTIONS: Array<[string, string]> = [
  ['products', 'sales-orders'], ['products', 'purchase-orders'],
  ['customers', 'sales-orders'], ['suppliers', 'purchase-orders'],
  ['sales-orders', 'invoices'], ['purchase-orders', 'invoices'],
  ['sales-orders', 'debts'], ['purchase-orders', 'debts'],
  ['debts', 'cash-book'], ['invoices', 'debts'],
  ['payroll', 'cash-book'], ['cash-book', 'reports'],
  ['alerts', 'sales-orders'], ['alerts', 'debts'],
];

function CentralCore({ activity }: { activity: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const halo2Ref = useRef<THREE.Mesh>(null);
  const bigHaloRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.12;
    if (haloRef.current) haloRef.current.rotation.z += delta * 0.25;
    if (halo2Ref.current) halo2Ref.current.rotation.z -= delta * 0.18;
    if (bigHaloRef.current) bigHaloRef.current.rotation.y += delta * 0.05;
  });
  return (
    <group>
      {/* Big outer halo ring */}
      <mesh ref={bigHaloRef} rotation={[Math.PI / 2.1, 0, 0]}>
        <torusGeometry args={[13, 0.02, 8, 128]} />
        <meshBasicMaterial color="#8ab4f8" transparent opacity={0.22} />
      </mesh>

      {/* Core sphere - smaller để không che text */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.6, 64, 64]} />
        <meshPhysicalMaterial
          color="#1e3a8a"
          emissive="#1677ff"
          emissiveIntensity={0.85}
          transparent
          opacity={0.78}
          roughness={0.1}
          metalness={0.3}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Inner rings */}
      <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.2, 0.02, 8, 100]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} />
      </mesh>
      <mesh ref={halo2Ref} rotation={[Math.PI / 2.3, Math.PI / 6, 0]}>
        <torusGeometry args={[2.7, 0.015, 8, 100]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.35} />
      </mesh>

      {/* Glow halo */}
      <mesh>
        <sphereGeometry args={[1.9, 32, 32]} />
        <meshBasicMaterial color="#4096ff" transparent opacity={0.08} />
      </mesh>

      {/* Text: lift cao hơn bán kính sphere để không bị che */}
      <Billboard position={[0, 2.2, 0]}>
        <Text fontSize={0.2} color="#8ab4f8" anchorX="center" anchorY="bottom" letterSpacing={0.25} outlineWidth={0.015} outlineColor="#000">SYSTEM THROUGHPUT</Text>
      </Billboard>
      <Billboard position={[0, 0, 0]}>
        <Text fontSize={1.3} color="#ffffff" anchorX="center" anchorY="middle" fontWeight={700} outlineWidth={0.03} outlineColor="#0a0a15">{activity}</Text>
      </Billboard>
      <Billboard position={[0, -0.95, 0]}>
        <Text fontSize={0.22} color="#a0a0b0" anchorX="center" anchorY="top" outlineWidth={0.015} outlineColor="#000">hoạt động / phút</Text>
      </Billboard>
      <Billboard position={[0, -2.6, 0]}>
        <Text fontSize={0.24} color="#c0c0d0" anchorX="center">PackFlow Core</Text>
      </Billboard>
    </group>
  );
}

function ModuleOrb({ m, onClick, showLabel }: { m: ModuleNode; onClick: () => void; showLabel: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime() * m.speed + m.angle;
    groupRef.current.position.x = Math.cos(t) * m.radius;
    groupRef.current.position.z = Math.sin(t) * m.radius;
    groupRef.current.position.y = m.elev;
    groupRef.current.rotation.y += 0.004;
    if (glowRef.current) {
      const scale = 1 + Math.sin(clock.getElapsedTime() * 2 + m.angle) * 0.04;
      glowRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Outer glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[m.size * 1.25, 32, 32]} />
        <meshBasicMaterial color={m.color} transparent opacity={0.12} />
      </mesh>

      {/* Main sphere - frosted planet look */}
      <mesh
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[m.size, 48, 48]} />
        <meshPhysicalMaterial
          color={m.color}
          emissive={m.color}
          emissiveIntensity={hovered ? 0.7 : 0.35}
          roughness={0.25}
          metalness={0.15}
          clearcoat={0.9}
          clearcoatRoughness={0.15}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Icon inside sphere - via HTML overlay */}
      <Html
        center
        distanceFactor={6}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          fontSize: 42,
          color: 'rgba(20,20,30,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
        }}>
          <m.Icon />
        </div>
      </Html>

      {showLabel && (
        <Billboard position={[0, m.size + 0.45, 0]}>
          <Text fontSize={0.24} color="#fff" anchorX="center" anchorY="bottom" outlineWidth={0.012} outlineColor="#000">{m.name}</Text>
          <Text fontSize={0.15} color={m.color} anchorX="center" anchorY="top" position={[0, -0.05, 0]}>{m.metricLabel}: {m.metric}</Text>
        </Billboard>
      )}
    </group>
  );
}

function CentralConnectionBeam({ module }: { module: ModuleNode }) {
  const particleRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<any>(null);
  const offset = useMemo(() => Math.random(), []);
  const initialArr = useMemo(() => new Float32Array(2 * 3), []);

  useFrame(({ clock }) => {
    const c = clock.getElapsedTime();
    const t = c * module.speed + module.angle;
    const endX = Math.cos(t) * module.radius;
    const endZ = Math.sin(t) * module.radius;
    const endY = module.elev;

    if (lineRef.current) {
      const positions = lineRef.current.geometry.attributes.position.array as Float32Array;
      // Start near center (at edge of core sphere), end at orb
      const dir = new THREE.Vector3(endX, endY, endZ).normalize();
      const start = dir.clone().multiplyScalar(1.6);
      positions[0] = start.x; positions[1] = start.y; positions[2] = start.z;
      positions[3] = endX; positions[4] = endY; positions[5] = endZ;
      lineRef.current.geometry.attributes.position.needsUpdate = true;
    }
    if (particleRef.current) {
      const dir = new THREE.Vector3(endX, endY, endZ);
      const tNorm = ((c * 0.4 + offset) % 1);
      const start = dir.clone().normalize().multiplyScalar(2.3);
      particleRef.current.position.lerpVectors(start, dir, tNorm);
    }
  });

  return (
    <>
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={initialArr} itemSize={3} args={[initialArr, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={module.color} transparent opacity={0.55} linewidth={2} />
      </line>
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={module.color} />
      </mesh>
    </>
  );
}

function ModuleConnectionBeam({ from, to, color }: { from: ModuleNode; to: ModuleNode; color: string }) {
  const lineRef = useRef<any>(null);
  const initialArr = useMemo(() => new Float32Array(41 * 3), []);

  const getPos = (m: ModuleNode, clock: number): THREE.Vector3 => {
    const t = clock * m.speed + m.angle;
    return new THREE.Vector3(
      Math.cos(t) * m.radius,
      m.elev,
      Math.sin(t) * m.radius,
    );
  };

  useFrame(({ clock }) => {
    const c = clock.getElapsedTime();
    const start = getPos(from, c);
    const end = getPos(to, c);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y += 1 + Math.sin(c) * 0.3;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const pts = curve.getPoints(40);

    if (lineRef.current) {
      const positions = lineRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pts.length; i++) {
        positions[i * 3] = pts[i].x;
        positions[i * 3 + 1] = pts[i].y;
        positions[i * 3 + 2] = pts[i].z;
      }
      lineRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={41} array={initialArr} itemSize={3} args={[initialArr, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.15} />
    </line>
  );
}

function Scene({ modules, activity, showLabels, onSelect }: { modules: ModuleNode[]; activity: number; showLabels: boolean; onSelect: (m: ModuleNode) => void }) {
  const moduleMap = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);
  const interConnections = useMemo(() =>
    CONNECTIONS.filter(([a, b]) => moduleMap.has(a) && moduleMap.has(b))
      .map(([a, b]) => ({ from: moduleMap.get(a)!, to: moduleMap.get(b)!, color: moduleMap.get(a)!.color })),
  [moduleMap]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={2.5} color="#4096ff" distance={25} />
      <pointLight position={[10, 10, 10]} intensity={0.6} color="#ffffff" />
      <pointLight position={[-10, -5, -10]} intensity={0.3} color="#a78bfa" />
      <Stars radius={150} depth={70} count={7000} factor={4.5} saturation={0} fade speed={0.7} />

      <CentralCore activity={activity} />
      {modules.map((m) => <CentralConnectionBeam key={`cc-${m.id}`} module={m} />)}
      {interConnections.map((c, i) => <ModuleConnectionBeam key={`mc-${i}`} from={c.from} to={c.to} color={c.color} />)}
      {modules.map((m) => <ModuleOrb key={m.id} m={m} onClick={() => onSelect(m)} showLabel={showLabels} />)}
    </>
  );
}

const UniversePage: React.FC = () => {
  const navigate = useNavigate();
  const [showLabels, setShowLabels] = useState(true);
  const [realtime, setRealtime] = useState(true);
  const [resetKey, setResetKey] = useState(0);

  const { data: overviewData, isLoading } = useQuery({
    queryKey: ['universe-overview'],
    queryFn: async () => apiClient.get('/dashboard'),
  });
  const { data: productsData } = useQuery({
    queryKey: ['universe-products-count'],
    queryFn: async () => apiClient.get('/products', { params: { limit: 1 } }),
  });
  const { data: customersData } = useQuery({
    queryKey: ['universe-customers-count'],
    queryFn: async () => apiClient.get('/customers', { params: { limit: 1 } }),
  });
  const { data: suppliersData } = useQuery({
    queryKey: ['universe-suppliers-count'],
    queryFn: async () => apiClient.get('/suppliers', { params: { limit: 1 } }),
  });

  const modules = useMemo<ModuleNode[]>(() => {
    const o = (overviewData?.data as any)?.data || {};
    const productCount = (productsData?.data as any)?.meta?.total || 0;
    const customerCount = (customersData?.data as any)?.meta?.total || 0;
    const supplierCount = (suppliersData?.data as any)?.meta?.total || 0;
    const salesCount = (o.orders_by_status || []).reduce((s: number, r: any) => s + Number(r.count || 0), 0);
    const purchaseCount = (o.upcoming_deliveries || []).length;
    const receivable = Number(o.receivable?.total_amount || 0);
    const payable = Number(o.payable?.total_amount || 0);
    const cashBalance = Number(o.cash_book?.balance || 0);
    const invoiceCount = (o.recent_orders || []).length;
    const payrollTotal = Number(o.payroll_summary?.total_net || 0);

    const metrics: Record<string, { label: string; value: string | number }> = {
      products: { label: 'SKU', value: productCount },
      customers: { label: 'KH', value: customerCount },
      suppliers: { label: 'NCC', value: supplierCount },
      'sales-orders': { label: 'đơn', value: salesCount },
      'purchase-orders': { label: 'sắp giao', value: purchaseCount },
      debts: { label: 'Thu-Trả', value: formatVND(receivable - payable) },
      'cash-book': { label: 'Dư', value: formatVND(cashBalance) },
      invoices: { label: 'gần đây', value: invoiceCount },
      payroll: { label: 'Net', value: formatVND(payrollTotal) },
      reports: { label: '', value: 'Xem' },
      alerts: { label: 'mới', value: 0 },
      aura: { label: '', value: 'Trợ lý' },
    };

    const n = MODULES_META.length;
    return MODULES_META.map((d, i) => ({
      ...d,
      metricLabel: metrics[d.id]?.label || '',
      metric: metrics[d.id]?.value ?? '',
      radius: 13,
      angle: (i / n) * Math.PI * 2,
      speed: 0.06,
      size: 0.7,
      elev: 0,
    }));
  }, [overviewData, productsData, customersData, suppliersData]);

  const [activity, setActivity] = useState(0);
  const [statusPill, setStatusPill] = useState<{ module: string; ms: number } | null>(null);
  React.useEffect(() => {
    if (!realtime) return;
    const iv = setInterval(() => setActivity(Math.floor(Math.random() * 80) + 20), 1500);
    return () => clearInterval(iv);
  }, [realtime]);
  React.useEffect(() => {
    if (!realtime || modules.length === 0) return;
    const iv = setInterval(() => {
      const m = modules[Math.floor(Math.random() * modules.length)];
      const action = ['SYNC', 'WRITE', 'READ', 'CALC'][Math.floor(Math.random() * 4)];
      setStatusPill({ module: `${action} · ${m.name.toUpperCase().slice(0, 6)}`, ms: Math.floor(Math.random() * 20) + 2 });
    }, 2200);
    return () => clearInterval(iv);
  }, [realtime, modules]);

  const handleSelect = (m: ModuleNode) => { navigate(m.path); };

  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' && window.innerWidth < 768);
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const overlayBtn: React.CSSProperties = { background: 'rgba(20,20,25,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', color: '#ccc', backdropFilter: 'blur(8px)' };
  const statCard: React.CSSProperties = { background: 'rgba(20,20,25,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: isMobile ? '6px 10px' : '10px 14px', minWidth: isMobile ? 70 : 100, backdropFilter: 'blur(8px)' };

  const o = (overviewData?.data as any)?.data || {};
  const totalSO = (o.orders_by_status || []).reduce((s: number, r: any) => s + Number(r.count || 0), 0);
  const receivableTotal = Number(o.receivable?.total_amount || 0);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#05050a', overflow: 'hidden', zIndex: 100 }}>
      <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/')}
        style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, color: '#fff', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
        Dashboard
      </Button>

      {!isMobile && (
        <div style={{ position: 'absolute', top: 16, left: 140, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(22,119,255,0.15)', border: '1px solid rgba(22,119,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
            <GlobalOutlined style={{ fontSize: 20 }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>PackFlow Universe</div>
            <div style={{ color: '#4ade80', fontSize: 10, letterSpacing: 1.2 }}>● HỆ SINH THÁI TÍNH NĂNG</div>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: isMobile ? '60vw' : 'none' }}>
        <div style={statCard}>
          <div style={{ color: '#fff', fontSize: isMobile ? 15 : 18, fontWeight: 700 }}>{modules.length}</div>
          <div style={{ color: '#888', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>Tính năng</div>
        </div>
        <div style={statCard}>
          <div style={{ color: '#fff', fontSize: isMobile ? 15 : 18, fontWeight: 700 }}>{totalSO}</div>
          <div style={{ color: '#888', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>Đơn bán</div>
        </div>
        {!isMobile && (
          <div style={statCard}>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{receivableTotal > 0 ? (receivableTotal / 1e9).toFixed(2) + ' tỷ' : '—'}</div>
            <div style={{ color: '#888', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>Phải thu</div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Canvas key={resetKey} camera={{ position: [0, 2, 28], fov: 55 }} gl={{ antialias: true, alpha: false }} style={{ background: 'radial-gradient(ellipse at center, #0a0a15 0%, #05050a 60%, #000 100%)' }}>
          <Suspense fallback={null}>
            <Scene modules={modules} activity={activity} showLabels={showLabels} onSelect={handleSelect} />
            <EffectComposer>
              <Bloom intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.9} mipmapBlur />
            </EffectComposer>
            <OrbitControls enablePan={false} minDistance={14} maxDistance={50} autoRotate={realtime} autoRotateSpeed={0.3} />
          </Suspense>
        </Canvas>
      )}

      {statusPill && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
          background: 'rgba(20,20,30,0.75)', border: '1px solid rgba(74,222,128,0.3)',
          borderRadius: 20, padding: '8px 18px', color: '#a0a0b0', fontSize: 12, letterSpacing: 1,
          backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
          <span>{statusPill.module}</span>
          <span style={{ color: '#666' }}>·</span>
          <span>{statusPill.ms}ms</span>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Space size={16} style={{ color: '#888', fontSize: 12 }}>
          <span><DragOutlined /> Kéo xoay</span>
          <span><ExpandAltOutlined /> Scroll zoom</span>
          <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 4 }}>Click</span>
          <span>tính năng để mở</span>
        </Space>
        <Space size={12}>
          <span style={overlayBtn}>
            <Switch checked={realtime} onChange={setRealtime} size="small" /> <span style={{ marginLeft: 6 }}>Realtime</span>
          </span>
          <span style={overlayBtn}>
            <Switch checked={showLabels} onChange={setShowLabels} size="small" /> <span style={{ marginLeft: 6 }}>Labels</span>
          </span>
          <Button icon={<ReloadOutlined />} onClick={() => setResetKey((k) => k + 1)} style={overlayBtn as any}>Reset</Button>
        </Space>
      </div>
    </div>
  );
};

export default UniversePage;
