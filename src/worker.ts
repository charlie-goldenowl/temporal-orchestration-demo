import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { activities } from './activities/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: 'order-task-queue',
    workflowsPath: join(__dirname, 'workflows', 'order-workflow.ts'),
    activities,
  });

  const workerId = process.env.WORKER_ID || '0';
  console.log(`🚀 Temporal Worker #${workerId} started...`);
  console.log('📋 Listening on task queue: order-task-queue');
  console.log('⏳ Waiting for workflow execution...\n');

  await worker.run();
}

run().catch((err) => {
  console.error('❌ Error running worker:', err);
  process.exit(1);
});
