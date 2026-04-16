export const statusColors: Record<string, string> = {
  // Sales Order / Purchase Order
  DRAFT: 'default',
  PENDING: 'gold',
  NEW: 'blue',
  CONFIRMED: 'cyan',
  PREPARING: 'geekblue',
  PROCESSING: 'geekblue',
  INVOICED: 'blue',
  SHIPPING: 'purple',
  COMPLETED: 'green',
  CANCELLED: 'red',
  // Return
  APPROVED: 'cyan',
  RECEIVING: 'orange',
  REJECTED: 'red',
  // Debt
  UNPAID: 'orange',
  PARTIAL: 'blue',
  PAID: 'green',
  OVERDUE: 'red',
};
