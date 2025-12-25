/**
 * Type definitions for the Temporal order service
 */

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderData {
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
}

export interface Order {
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'created' | 'cancelled';
  createdAt: string;
  cancelledAt?: string;
}

export interface InventoryItem {
  name: string;
  quantity: number;
  reserved?: number;
}

export interface Payment {
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  status: 'completed' | 'refunded';
  processedAt: string;
  refundedAt?: string;
}

export interface ActivityResult {
  success: boolean;
  message?: string;
}

export interface CreateOrderResult extends ActivityResult {
  orderId?: string;
  userId?: string;
  items?: OrderItem[];
  totalAmount?: number;
  status?: string;
  createdAt?: string;
}

export interface ReserveInventoryResult extends ActivityResult {
  message?: string;
}

export interface ProcessPaymentResult extends ActivityResult {
  paymentId?: string;
  amount?: number;
  message?: string;
}

export interface SendEmailResult extends ActivityResult {
  message?: string;
}

export interface WorkflowResult {
  success: boolean;
  orderId: string;
  message: string;
  paymentId?: string;
  error?: string;
}

export interface CompensationStep {
  type: 'cancelOrder' | 'releaseInventory' | 'refundPayment';
  data: {
    orderId: string;
    items?: OrderItem[];
    paymentId?: string;
  };
}
