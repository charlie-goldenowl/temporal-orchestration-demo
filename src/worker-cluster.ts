import { type ChildProcess, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Number of workers to run (can be set via env or default)
const WORKER_COUNT = Number.parseInt(process.env.WORKER_COUNT || '4', 10);
console.log(`🚀 Starting ${WORKER_COUNT} workers...\n`);

const workers: ChildProcess[] = [];

// Create and run multiple worker processes
for (let i = 0; i < WORKER_COUNT; i++) {
  const worker = spawn('tsx', [join(__dirname, 'worker.ts')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      WORKER_ID: i.toString(),
    },
  });

  workers.push(worker);

  worker.on('error', (err) => {
    console.error(`❌ Worker ${i} error:`, err);
  });

  worker.on('exit', (code) => {
    console.log(`⚠️  Worker ${i} stopped with code: ${code}`);
  });
}

// Handle stop signals (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping all workers...');
  for (const worker of workers) {
    worker.kill('SIGINT');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping all workers...');
  for (const worker of workers) {
    worker.kill('SIGTERM');
  }
  process.exit(0);
});

console.log(`✅ Started ${WORKER_COUNT} workers`);
console.log('📊 Each worker will process workflows/activities in parallel\n');
console.log('💡 Tips:');
console.log('   - Each worker can process multiple tasks in parallel');
console.log('   - Temporal automatically distributes tasks among workers');
console.log('   - Optimal number of workers depends on CPU and memory');
console.log('   - Set WORKER_COUNT=8 to run 8 workers\n');
