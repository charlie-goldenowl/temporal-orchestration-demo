import {
  cancelOrderActivity,
  createOrderActivity,
  processPaymentActivity,
  refundPaymentActivity,
  releaseInventoryActivity,
  reserveInventoryActivity,
  sendCancellationEmailActivity,
  sendConfirmationEmailActivity,
} from './order-activities.js';

export const activities = {
  createOrder: createOrderActivity,
  reserveInventory: reserveInventoryActivity,
  processPayment: processPaymentActivity,
  sendConfirmationEmail: sendConfirmationEmailActivity,
  cancelOrder: cancelOrderActivity,
  releaseInventory: releaseInventoryActivity,
  refundPayment: refundPaymentActivity,
  sendCancellationEmail: sendCancellationEmailActivity,
};
