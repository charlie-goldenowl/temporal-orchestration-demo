import { log, proxyActivities, sleep } from '@temporalio/workflow';
import type { CompensationStep, OrderData, WorkflowResult } from '../types/index.js';

const {
  createOrder,
  reserveInventory,
  processPayment,
  sendConfirmationEmail,
  cancelOrder,
  releaseInventory,
  refundPayment,
  sendCancellationEmail,
} = proxyActivities({
  scheduleToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s', // Đợi 1s trước lần retry đầu tiên
    backoffCoefficient: 2.0, // Tăng dần: 1s → 2s → 4s
    maximumInterval: '10s', // Tối đa đợi 10s giữa các lần retry
    maximumAttempts: 3, // Retry tối đa 3 lần
    // nonRetryableErrorTypes: ['PaymentValidationError'], // Các lỗi không retry
  },
});

/**
 * SAGA pattern workflow for order processing and payment
 * Handles both success and failure cases with compensation
 */
export async function orderWorkflow(orderData: OrderData): Promise<WorkflowResult> {
  const { orderId, userId, items, totalAmount } = orderData;
  const compensationSteps: CompensationStep[] = [];

  log.info('🚀 Starting order workflow', { orderId, userId, totalAmount });

  try {
    // Step 1: Create order
    log.info('📝 Step 1: Creating order...');
    await createOrder({ orderId, userId, items, totalAmount });
    compensationSteps.push({ type: 'cancelOrder', data: { orderId } });

    await sleep('2s'); // Simulate delay

    // Step 2: Reserve inventory
    log.info('📦 Step 2: Reserving inventory...');
    const inventoryResult = await reserveInventory({ orderId, items });
    compensationSteps.push({ type: 'releaseInventory', data: { orderId, items } });

    if (!inventoryResult.success) {
      throw new Error('Insufficient inventory');
    }

    await sleep('2s');

    // Step 3: Process payment
    log.info('💳 Step 3: Processing payment...');
    // Payment scenarios (random):
    // - Success (60%) → Continue workflow
    // - Network/Server errors (25%) → Temporal auto-retry (3 attempts)
    //   → If still fail after retries → Workflow catch → Compensation
    // - Client/Business errors (15%) → No retry → Workflow catch → Compensation
    const paymentResult = await processPayment({ orderId, userId, amount: totalAmount });

    if (!paymentResult.success) {
      // Payment failed (client error or business logic) → Trigger compensation
      log.error('❌ Payment failed, triggering compensation', {
        orderId,
        reason: paymentResult.message,
      });
      throw new Error(`Payment failed: ${paymentResult.message || 'Unknown error'}`);
    }

    // Only add compensation if payment succeeded
    if (paymentResult.paymentId) {
      compensationSteps.push({
        type: 'refundPayment',
        data: { orderId, paymentId: paymentResult.paymentId },
      });
    }

    await sleep('2s');

    // Step 4: Send confirmation email
    log.info('📧 Step 4: Sending confirmation email...');
    await sendConfirmationEmail({ orderId, userId, totalAmount });

    log.info('✅ Order completed successfully!', { orderId });

    return {
      success: true,
      orderId,
      message: 'Order processed successfully',
      paymentId: paymentResult.paymentId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log.error('❌ Error processing order', { error: errorMessage, orderId });

    // Execute compensation (rollback) in reverse order
    log.info('🔄 Starting compensation (rollback)...');

    for (let i = compensationSteps.length - 1; i >= 0; i--) {
      const step = compensationSteps[i];
      try {
        log.info(`🔄 Compensating: ${step.type}`, step.data);

        switch (step.type) {
          case 'refundPayment':
            await refundPayment(step.data);
            break;
          case 'releaseInventory':
            await releaseInventory(step.data);
            break;
          case 'cancelOrder':
            await cancelOrder(step.data);
            break;
        }

        await sleep('1s');
      } catch (compError) {
        const compErrorMessage = compError instanceof Error ? compError.message : 'Unknown error';
        log.error(`❌ Error during compensation ${step.type}`, { error: compErrorMessage });
        // Continue compensation for other steps even if one fails
      }
    }

    // Send cancellation email
    try {
      await sendCancellationEmail({ orderId, userId, reason: errorMessage });
    } catch (emailError) {
      const emailErrorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
      log.error('❌ Error sending cancellation email', { error: emailErrorMessage });
    }

    return {
      success: false,
      orderId,
      error: errorMessage,
      message: 'Order cancelled and refunded',
    };
  }
}
