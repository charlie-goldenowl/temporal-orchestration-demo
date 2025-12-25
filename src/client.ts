import { Client, Connection } from '@temporalio/client';
import type { OrderData } from './types/index.js';
import { orderWorkflow } from './workflows/order-workflow.js';

async function run(): Promise<void> {
  const connection = await Connection.connect({
    address: 'localhost:7233',
  });

  const client = new Client({
    connection,
    namespace: 'default',
  });

  console.log('🔗 Connected to Temporal Server\n');

  // Test case 1: Successful order (amount < 1000)
  console.log('═══════════════════════════════════════════════════════');
  console.log('📦 TEST CASE 1: Successful Order');
  console.log('═══════════════════════════════════════════════════════\n');

  const orderData1: OrderData = {
    orderId: `order-${Date.now()}-1`,
    userId: 'user-123',
    items: [
      { itemId: 'item-1', name: 'Product 1', quantity: 2, price: 100 },
      { itemId: 'item-2', name: 'Product 2', quantity: 1, price: 200 },
    ],
    totalAmount: 400, // < 1000, will succeed
  };

  try {
    const handle = await client.workflow.start(orderWorkflow, {
      args: [orderData1],
      taskQueue: 'order-task-queue',
      workflowId: `order-workflow-${orderData1.orderId}`,
    });

    console.log(`🚀 Started workflow: ${handle.workflowId}`);
    console.log(`📋 Workflow Run ID: ${handle.firstExecutionRunId}\n`);

    const result = await handle.result();
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error starting workflow:');
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
      if ('cause' in error && error.cause) {
        console.error('   Cause:', error.cause);
      }
    } else {
      console.error('   Unknown error:', error);
    }
  }

  console.log('\n\n');

  // Wait a bit before running test case 2
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Test case 2: Failed order (amount > 1000) - will trigger compensation
  console.log('═══════════════════════════════════════════════════════');
  console.log('📦 TEST CASE 2: Failed Order (Compensation)');
  console.log('═══════════════════════════════════════════════════════\n');

  const orderData2: OrderData = {
    orderId: `order-${Date.now()}-2`,
    userId: 'user-456',
    items: [
      { itemId: 'item-1', name: 'Product 1', quantity: 5, price: 300 },
      { itemId: 'item-3', name: 'Product 3', quantity: 3, price: 400 },
    ],
    totalAmount: 2700, // > 1000, will fail and trigger compensation
  };

  try {
    const handle = await client.workflow.start(orderWorkflow, {
      args: [orderData2],
      taskQueue: 'order-task-queue',
      workflowId: `order-workflow-${orderData2.orderId}`,
    });

    console.log(`🚀 Started workflow: ${handle.workflowId}`);
    console.log(`📋 Workflow Run ID: ${handle.firstExecutionRunId}\n`);

    const result = await handle.result();
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error starting workflow:');
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
      if ('cause' in error && error.cause) {
        console.error('   Cause:', error.cause);
      }
    } else {
      console.error('   Unknown error:', error);
    }
  }

  console.log('\n\n');
  console.log('✨ All test cases completed!');
  console.log('📊 Check Temporal UI at: http://localhost:8080\n');

  await connection.close();
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
