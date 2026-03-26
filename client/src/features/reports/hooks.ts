import { useQuery } from '@tanstack/react-query';
import { reportApi } from './api';

export function usePnlReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['pnl-report', from, to],
    queryFn: () => reportApi.getPnl(from!, to!).then(r => r.data),
    enabled: !!from && !!to,
  });
}

export function useDebtAgingReport() {
  return useQuery({
    queryKey: ['debt-aging'],
    queryFn: () => reportApi.getDebtAging().then(r => r.data),
  });
}

export function useProductSalesReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ['product-sales', from, to],
    queryFn: () => reportApi.getProductSales(from!, to!).then(r => r.data),
    enabled: !!from && !!to,
  });
}
