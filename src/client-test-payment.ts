import { Client, Connection } from '@temporalio/client';
import type { OrderData } from './types/index.js';
import { orderWorkflow } from './workflows/order-workflow.js';

/**
 * Test script to demonstrate various payment scenarios
 * Runs multiple orders to see different payment outcomes
 */
async function run(): Promise<void> {
  const connection = await Connection.connect({
    address: 'localhost:7233',
  });

  const client = new Client({
    connection,
    namespace: 'default',
  });

  console.log('🔗 Connected to Temporal Server\n');
  console.log('🧪 Testing Payment Scenarios (Random)');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Expected outcomes:');
  console.log('  ✅ Success: ~60%');
  console.log('  🔄 Retry (Network/Server): ~25%');
  console.log('  ❌ No Retry (Client/Business): ~15%');
  console.log('═══════════════════════════════════════════════════════\n\n');

  const testOrders: OrderData[] = [
    // Test 1: Small amount (likely success, but random scenarios)
    {
      orderId: `order-${Date.now()}-1`,
      userId: 'user-001',
      items: [
        { itemId: 'item-1', name: 'Product 1', quantity: 2, price: 50 },
      ],
      totalAmount: 100, // < 1000, no business rule failure
    },
    // Test 2: Medium amount
    {
      orderId: `order-${Date.now()}-2`,
      userId: 'user-002',
      items: [
        { itemId: 'item-2', name: 'Product 2', quantity: 3, price: 150 },
      ],
      totalAmount: 450,
    },
    // Test 3: Another medium amount
    {
      orderId: `order-${Date.now()}-3`,
      userId: 'user-003',
      items: [
        { itemId: 'item-3', name: 'Product 3', quantity: 1, price: 300 },
      ],
      totalAmount: 300,
    },
    // Test 4: Business rule failure (amount > 1000)
    {
      orderId: `order-${Date.now()}-4`,
      userId: 'user-004',
      items: [
        { itemId: 'item-1', name: 'Product 1', quantity: 10, price: 200 },
      ],
      totalAmount: 2000, // > 1000, will fail business rule
    },
    // Test 5: Another small amount
    {
      orderId: `order-${Date.now()}-5`,
      userId: 'user-005',
      items: [
        { itemId: 'item-2', name: 'Product 2', quantity: 1, price: 80 },
      ],
      totalAmount: 80,
    },
  ];

  const results: Array<{
    orderId: string;
    status: 'success' | 'failed' | 'error';
    result?: any;
    error?: string;
  }> = [];

  // Run all test orders
  for (let i = 0; i < testOrders.length; i++) {
    const orderData = testOrders[i];
    console.log(`\n📦 Test Order ${i + 1}/${testOrders.length}: ${orderData.orderId}`);
    console.log(`   Amount: ${orderData.totalAmount}, User: ${orderData.userId}`);

    try {
      const handle = await client.workflow.start(orderWorkflow, {
        args: [orderData],
        taskQueue: 'order-task-queue',
        workflowId: `order-workflow-${orderData.orderId}`,
      });

      console.log(`   🚀 Started: ${handle.workflowId}`);

      const result = await handle.result();

      if (result.success) {
        console.log(`   ✅ SUCCESS: Payment ID ${result.paymentId}`);
        results.push({ orderId: orderData.orderId, status: 'success', result });
      } else {
        console.log(`   ❌ FAILED: ${result.error || result.message}`);
        results.push({
          orderId: orderData.orderId,
          status: 'failed',
          result,
          error: result.error || result.message,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`   ❌ ERROR: ${errorMessage}`);
      results.push({
        orderId: orderData.orderId,
        status: 'error',
        error: errorMessage,
      });
    }

    // Small delay between orders
    if (i < testOrders.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  console.log(`✅ Success: ${successCount}/${results.length} (${((successCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failedCount}/${results.length} (${((failedCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`⚠️  Error: ${errorCount}/${results.length} (${((errorCount / results.length) * 100).toFixed(1)}%)`);

  console.log('\n📋 Details:');
  results.forEach((r, idx) => {
    const icon = r.status === 'success' ? '✅' : r.status === 'failed' ? '❌' : '⚠️';
    console.log(`   ${icon} Order ${idx + 1}: ${r.orderId} - ${r.status.toUpperCase()}`);
    if (r.error) {
      console.log(`      Error: ${r.error}`);
    }
  });

  console.log('\n💡 Check Temporal UI at: http://localhost:8080');
  console.log('   Filter by: OrderStatus = "FAILED" to see failed workflows');
  console.log('   Filter by: OrderStatus = "COMPLETED" to see successful workflows\n');

  await connection.close();
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

