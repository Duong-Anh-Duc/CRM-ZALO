import { toolRegistry } from '../tool-registry';
import { ToolDefinition } from '../types';
import { queryTools } from './query.tools';
import { searchTools } from './search.tools';
import { visionTools } from './vision.tools';
import { customerTools } from './customer.tools';
import { supplierTools } from './supplier.tools';
import { productTools } from './product.tools';
import { orderTools } from './order.tools';
import { invoiceTools } from './invoice.tools';
import { returnTools } from './return.tools';
import { paymentTools } from './payment.tools';
import { cashTools } from './cash.tools';
import { payrollTools } from './payroll.tools';
import { alertTools } from './alert.tools';
import { zaloTools } from './zalo.tools';
import { exportTools } from './export.tools';
import { trainingTools } from './training.tools';
import { helpTools } from './help.tools';
import { confirmTools } from './confirm.tools';
import { memoryTools } from './memory.tools';

let registered = false;

const withAudit = (tools: ToolDefinition[]): ToolDefinition[] =>
  tools.map((t) => ({ ...t, audit: true }));

const DESTRUCTIVE_TOOLS = new Set([
  'delete_customer',
  'delete_supplier',
  'delete_product',
  'delete_product_category',
  'delete_cash_category',
  'delete_cash_transaction',
  'delete_operating_cost',
  'delete_operating_cost_category',
  'delete_customer_product_price',
  'delete_supplier_price',
  'delete_sales_return',
  'delete_purchase_return',
  'delete_employee_profile',
  'delete_ai_training',
  'remove_sales_order_item',
  'finalize_invoice',
  'cancel_invoice',
  'approve_payroll',
  'mark_payroll_paid',
]);

const markDestructive = (tools: ToolDefinition[]): ToolDefinition[] =>
  tools.map((t) =>
    DESTRUCTIVE_TOOLS.has(t.schema.function.name)
      ? { ...t, requiresConfirmation: true }
      : t,
  );

const writeAndConfirmable = (tools: ToolDefinition[]): ToolDefinition[] =>
  markDestructive(withAudit(tools));

export function registerAllTools(): void {
  if (registered) return;
  // Read-only tools — no audit, no confirmation
  toolRegistry.registerAll(queryTools);
  toolRegistry.registerAll(searchTools);
  toolRegistry.registerAll(visionTools);
  toolRegistry.registerAll(helpTools);

  // Write tools — audited, destructive subset requires confirmation
  toolRegistry.registerAll(writeAndConfirmable(customerTools));
  toolRegistry.registerAll(writeAndConfirmable(supplierTools));
  toolRegistry.registerAll(writeAndConfirmable(productTools));
  toolRegistry.registerAll(writeAndConfirmable(orderTools));
  toolRegistry.registerAll(writeAndConfirmable(invoiceTools));
  toolRegistry.registerAll(writeAndConfirmable(returnTools));
  toolRegistry.registerAll(writeAndConfirmable(paymentTools));
  toolRegistry.registerAll(writeAndConfirmable(cashTools));
  toolRegistry.registerAll(writeAndConfirmable(payrollTools));
  toolRegistry.registerAll(writeAndConfirmable(alertTools));
  toolRegistry.registerAll(writeAndConfirmable(exportTools));

  // Mixed groups — audit flag set per-tool inline (still pass through markDestructive)
  toolRegistry.registerAll(markDestructive(zaloTools));
  toolRegistry.registerAll(markDestructive(trainingTools));

  // Confirmation tool — global, not audited (audit is recorded for the inner tool)
  toolRegistry.registerAll(confirmTools);

  // Long-term memory tools — audited so we can trace remember/forget changes
  toolRegistry.registerAll(withAudit(memoryTools));

  registered = true;
}
