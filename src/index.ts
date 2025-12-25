/**
 * Main entry point
 * Can run worker or client depending on argument
 */

const command = process.argv[2];

if (command === 'worker') {
  import('./worker.js');
} else if (command === 'client') {
  import('./client.js');
} else {
  console.log('Usage:');
  console.log('  node src/index.js worker  - Run Temporal Worker');
  console.log('  node src/index.js client  - Run Client to test workflows');
}
