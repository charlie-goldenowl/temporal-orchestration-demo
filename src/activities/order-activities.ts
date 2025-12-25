import { log } from '@temporalio/activity';
import type {
  CreateOrderResult,
  InventoryItem,
  Order,
  OrderData,
  OrderItem,
  Payment,
  ProcessPaymentResult,
  ReserveInventoryResult,
  SendEmailResult,
} from '../types/index.js';

// Simulate database/storage
const orders = new Map<string, Order>();
const inventory = new Map<string, InventoryItem>([
  ['item-1', { name: 'Product 1', quantity: 10 }],
  ['item-2', { name: 'Product 2', quantity: 5 }],
  ['item-3', { name: 'Product 3', quantity: 8 }],
]);
const payments = new Map<string, Payment>();

/**
 * Activity: Create order
 */
export async function createOrderActivity({
  orderId,
  userId,
  items,
  totalAmount,
}: OrderData): Promise<CreateOrderResult> {
  log.info('📝 Activity: Creating order', { orderId, userId, items, totalAmount });

  // Simulate delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const order: Order = {
    orderId,
    userId,
    items,
    totalAmount,
    status: 'created',
    createdAt: new Date().toISOString(),
  };

  orders.set(orderId, order);
  log.info('✅ Order created', { orderId });

  return {
    success: true,
    ...order,
  };
}

/**
 * Activity: Reserve inventory
 */
export async function reserveInventoryActivity({
  orderId,
  items,
}: {
  orderId: string;
  items: OrderItem[];
}): Promise<ReserveInventoryResult> {
  log.info('📦 Activity: Reserving inventory', { orderId, items });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Check and reserve inventory
  for (const item of items) {
    const stock = inventory.get(item.itemId);
    if (!stock || stock.quantity < item.quantity) {
      log.error('❌ Insufficient inventory', {
        itemId: item.itemId,
        required: item.quantity,
        available: stock?.quantity,
      });
      return {
        success: false,
        message: `Insufficient inventory for product ${item.itemId}`,
      };
    }
    stock.quantity -= item.quantity;
    stock.reserved = (stock.reserved || 0) + item.quantity;
  }

  log.info('✅ Inventory reserved', { orderId });
  return { success: true, message: 'Inventory reserved successfully' };
}

/**
 * Activity: Process payment
 * Simulates payment API call with various failure scenarios
 * 
 * Scenarios (random, realistic probabilities):
 * 1. ✅ Success (~67% of valid amounts) - Payment processed successfully
 * 2. 🔄 Network/Timeout (15%) - Will retry (transient error)
 * 3. 🔄 Server Error 500 (10%) - Will retry (transient error)
 * 4. ❌ Client Error 400 (5%) - No retry (validation error)
 * 5. ❌ Client Error 401 (3%) - No retry (auth error)
 * 6. ❌ Business Logic Error (amount > 1000) - No retry, checked first
 * 
 * Retry behavior:
 * - Network/Server errors → Temporal auto-retry (3 attempts with backoff)
 * - Client/Business errors → No retry, return failure immediately
 */
export async function processPaymentActivity({
  orderId,
  userId,
  amount,
}: {
  orderId: string;
  userId: string;
  amount: number;
}): Promise<ProcessPaymentResult> {
  log.info('💳 Activity: Processing payment', { orderId, userId, amount });

  // Simulate API call delay (1-2 seconds)
  const delay = 1000 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Generate random scenario (0-100)
  const random = Math.random() * 100;

  // Scenario 1: Business Logic Error (7%) - No retry
  // Check business rules first (before API call)
  if (amount > 1000) {
    log.error('❌ Payment failed: Amount exceeds limit (business rule)', {
      amount,
      limit: 1000,
    });
    return {
      success: false,
      message: 'Payment failed: Amount exceeds limit of 1000',
    };
  }

  // Scenario 2: Network Timeout (15%) - Will retry
  if (random < 15) {
    log.error('❌ Payment failed: Network timeout (will retry)', {
      orderId,
      attempt: 'will be retried by Temporal',
    });
    // Throw error → Temporal will retry
    throw new Error('Payment API timeout - network connection failed');
  }

  // Scenario 3: Server Error 500 (10%) - Will retry
  if (random >= 15 && random < 25) {
    log.error('❌ Payment failed: Server error 500 (will retry)', {
      orderId,
      status: 500,
    });
    // Throw error → Temporal will retry
    throw new Error('Payment API server error 500 - Internal server error');
  }

  // Scenario 4: Client Error 400 - Bad Request (5%) - No retry
  if (random >= 25 && random < 30) {
    log.error('❌ Payment failed: Client error 400 (no retry)', {
      orderId,
      status: 400,
      reason: 'Invalid request format',
    });
    // Return failure (not throw) → No retry
    return {
      success: false,
      message: 'Payment failed: Invalid request format (400 Bad Request)',
    };
  }

  // Scenario 5: Client Error 401 - Unauthorized (3%) - No retry
  if (random >= 30 && random < 33) {
    log.error('❌ Payment failed: Client error 401 (no retry)', {
      orderId,
      status: 401,
      reason: 'Invalid API credentials',
    });
    // Return failure (not throw) → No retry
    return {
      success: false,
      message: 'Payment failed: Invalid API credentials (401 Unauthorized)',
    };
  }

  // Scenario 6: Success (~67% remaining, but we'll make it ~60% overall)
  // After all error scenarios (33%), remaining 67% should be success
  // But to get ~60% success rate overall, we adjust:
  // If random >= 33, it's success (67% of cases where amount <= 1000)
  // Overall: ~60% success (accounting for business rule failures)
  const paymentId = `payment-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const payment: Payment = {
    paymentId,
    orderId,
    userId,
    amount,
    status: 'completed',
    processedAt: new Date().toISOString(),
  };

  payments.set(paymentId, payment);
  log.info('✅ Payment successful', {
    paymentId,
    amount,
    orderId,
  });

  return { success: true, paymentId, amount };
}

/**
 * Activity: Send confirmation email
 */
export async function sendConfirmationEmailActivity({
  orderId,
  userId,
  totalAmount,
}: {
  orderId: string;
  userId: string;
  totalAmount: number;
}): Promise<SendEmailResult> {
  log.info('📧 Activity: Sending confirmation email', { orderId, userId, totalAmount });

  await new Promise((resolve) => setTimeout(resolve, 800));

  // Simulate sending email
  log.info('✅ Confirmation email sent', {
    to: `user-${userId}@example.com`,
    subject: `Order Confirmation #${orderId}`,
    body: `Your order has been confirmed. Total: ${totalAmount} VND`,
  });

  return { success: true, message: 'Email sent' };
}

/**
 * Compensation Activity: Cancel order
 */
export async function cancelOrderActivity({
  orderId,
}: {
  orderId: string;
}): Promise<{ success: boolean; message: string }> {
  log.info('🔄 Compensation: Cancelling order', { orderId });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const order = orders.get(orderId);
  if (order) {
    order.status = 'cancelled';
    order.cancelledAt = new Date().toISOString();
    log.info('✅ Order cancelled', { orderId });
  }

  return { success: true, message: 'Order cancelled' };
}

/**
 * Compensation Activity: Release inventory
 */
export async function releaseInventoryActivity({
  orderId,
  items,
}: {
  orderId: string;
  items: OrderItem[];
}): Promise<{ success: boolean; message: string }> {
  log.info('🔄 Compensation: Releasing inventory', { orderId, items });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Return items to inventory
  for (const item of items) {
    const stock = inventory.get(item.itemId);
    if (stock) {
      stock.quantity += item.quantity;
      stock.reserved = Math.max(0, (stock.reserved || 0) - item.quantity);
    }
  }

  log.info('✅ Inventory released', { orderId });
  return { success: true, message: 'Inventory released' };
}

/**
 * Compensation Activity: Refund payment
 */
export async function refundPaymentActivity({
  orderId,
  paymentId,
}: {
  orderId: string;
  paymentId: string;
}): Promise<{ success: boolean; message: string }> {
  log.info('🔄 Compensation: Refunding payment', { orderId, paymentId });

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const payment = payments.get(paymentId);
  if (payment) {
    payment.status = 'refunded';
    payment.refundedAt = new Date().toISOString();
    log.info('✅ Payment refunded', { paymentId, amount: payment.amount });
  }

  return { success: true, message: 'Payment refunded' };
}

/**
 * Compensation Activity: Send cancellation email
 */
export async function sendCancellationEmailActivity({
  orderId,
  userId,
  reason,
}: {
  orderId: string;
  userId: string;
  reason: string;
}): Promise<{ success: boolean; message: string }> {
  log.info('🔄 Compensation: Sending cancellation email', { orderId, userId, reason });

  await new Promise((resolve) => setTimeout(resolve, 800));

  log.info('✅ Cancellation email sent', {
    to: `user-${userId}@example.com`,
    subject: `Order Cancellation #${orderId}`,
    body: `Your order has been cancelled. Reason: ${reason}`,
  });

  return { success: true, message: 'Cancellation email sent' };
}
