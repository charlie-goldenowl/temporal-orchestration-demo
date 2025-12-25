# Temporal Microservice - SAGA Pattern for Order Processing and Payment

A microservice system using Temporal orchestration with SAGA pattern to handle order processing and payment flows, including compensation (rollback) on errors.

## 🏗️ Architecture

This project uses **SAGA Pattern** to ensure data consistency in a microservice environment:

1. **Create Order** → Create record in database
2. **Reserve Inventory** → Deduct stock quantity
3. **Process Payment** → Charge customer account
4. **Send Confirmation Email** → Notify customer

If any step fails, the system will automatically **compensate (rollback)** the executed steps:
- Refund payment (if payment was processed)
- Return items to inventory (if inventory was reserved)
- Cancel order
- Send cancellation email

## 📋 Requirements

- Docker and Docker Compose
- Node.js 18+
- npm or yarn

## 🚀 Installation and Running

### 1. Start Temporal Server and UI

```bash
docker-compose up -d
```

This will start:
- **PostgreSQL** (port 5432) - Database for Temporal
- **Temporal Server** (port 7233) - Temporal backend
- **Temporal UI** (port 8080) - Dashboard to view workflows

Check Temporal UI at: http://localhost:8080

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Worker

**Run 1 worker:**
```bash
npm run start:worker
```

**Run multiple workers (scaling):**
```bash
# Run 4 workers (default)
npm run start:workers

# Run 2 workers
npm run start:workers:2

# Or set custom count
WORKER_COUNT=6 npm run start:workers
```

**Scaling Notes:**
- ✅ Running multiple workers helps process **multiple workflows/activities in parallel**
- ✅ Temporal automatically **distributes tasks** among workers
- ✅ Each worker can process **multiple tasks concurrently**
- ⚠️ Optimal number of workers depends on:
  - CPU cores of the machine
  - Available memory
  - Number of workflows to process
- 💡 **Recommendation**: Start with 2-4 workers, increase as needed

Or with auto-reload (1 worker):
```bash
npm run dev:worker
```

### 4. Run Client (Test)

In another terminal, run the client to test workflows:

```bash
npm run start:client
```

The client will automatically run 2 test cases:
- **Test Case 1**: Successful order (amount < 1000)
- **Test Case 2**: Failed order (amount > 1000) - will trigger compensation

## 🔍 Project Structure

```
temporal/
├── docker-compose.yml          # Docker compose for Temporal server
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── src/
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   ├── workflows/
│   │   └── order-workflow.ts   # Main SAGA pattern workflow
│   ├── activities/
│   │   ├── index.ts            # Export activities
│   │   └── order-activities.ts # Activities and compensation
│   ├── worker.ts               # Temporal worker
│   ├── worker-cluster.ts       # Multi-worker cluster
│   ├── client.ts               # Client to test workflows
│   ├── client-load-test.ts     # Load testing client
│   └── index.ts                # Entry point
└── README.md
```

## 🎯 Workflow Logic

### 📊 Success Flow (Happy Path)

```
┌─────────────────────────────────────────────────────────────┐
│                    Order Workflow Started                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Step 1: Create Order          │
        │  ✅ Create order record         │
        │  📝 Status: created            │
        └───────────────┬─────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Step 2: Reserve Inventory    │
        │  📦 Check stock availability   │
        │  🔒 Reserve items              │
        └───────────────┬─────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Step 3: Process Payment       │
        │  💳 Charge customer account    │
        │  ✅ Payment successful          │
        └───────────────┬─────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Step 4: Send Confirmation    │
        │  📧 Email sent to customer    │
        └───────────────┬─────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │     ✅ Order Completed         │
        │     Successfully!               │
        └───────────────────────────────┘
```

### ❌ Failure Flow (Compensation - SAGA Pattern)

```
┌─────────────────────────────────────────────────────────────┐
│                    Order Workflow Started                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Step 1: Create Order          │
        │  ✅ Create order record         │
        │  📝 Status: created            │
        │  🔄 Compensation: cancelOrder   │
        └───────────────┬─────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Step 2: Reserve Inventory    │
        │  📦 Check stock availability   │
        │  🔒 Reserve items              │
        │  🔄 Compensation: releaseInv    │
        └───────────────┬─────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Step 3: Process Payment      │
        │  💳 Charge customer account   │
        │  ❌ Payment FAILED!            │
        │  (amount > 1000)               │
        └───────────────┬─────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────────────────┐
        │         🔄 COMPENSATION PHASE (Rollback)          │
        │         (Executed in REVERSE order)               │
        └───────────────────────┬───────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Compensation Step 1  │
                    │  💰 Refund Payment    │
                    │  (if payment existed) │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Compensation Step 2  │
                    │  📦 Release Inventory │
                    │  Return items to stock│
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Compensation Step 3  │
                    │  ❌ Cancel Order       │
                    │  Update status        │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Compensation Step 4  │
                    │  📧 Send Cancellation  │
                    │  Email to customer    │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  ❌ Order Cancelled    │
                    │  All steps rolled back│
                    └───────────────────────┘
```

### 🔄 SAGA Pattern Explanation

**SAGA Pattern** ensures data consistency in distributed systems:

1. **Forward Steps**: Execute in order (1 → 2 → 3 → 4)
2. **Compensation Steps**: Execute in reverse order (4 → 3 → 2 → 1) when any step fails
3. **Idempotency**: Each compensation can be safely retried
4. **Durability**: Temporal ensures all steps are persisted and recoverable

### 📋 Step Details

| Step | Activity | Compensation | Description |
|------|----------|--------------|-------------|
| 1 | `createOrder` | `cancelOrder` | Create order record in database |
| 2 | `reserveInventory` | `releaseInventory` | Reserve items from inventory |
| 3 | `processPayment` | `refundPayment` | Charge customer's account |
| 4 | `sendConfirmationEmail` | `sendCancellationEmail` | Notify customer via email |

### 🎬 Example Scenarios

**Scenario 1: Success (amount = 400)**
```
Create Order → Reserve Inventory → Process Payment → Send Email
✅ All steps succeed → Order completed
```

**Scenario 2: Failure (amount = 2700)**
```
Create Order → Reserve Inventory → Process Payment ❌
                                    ↓
                    Compensation: Refund → Release → Cancel → Email
                    ✅ All steps rolled back → Order cancelled
```

## 🧪 Test Cases

### Test Case 1: Success
```javascript
{
  orderId: "order-xxx-1",
  totalAmount: 400,  // < 1000 → success
  items: [...]
}
```

### Test Case 2: Failure (Compensation)
```javascript
{
  orderId: "order-xxx-2",
  totalAmount: 2700,  // > 1000 → failure → compensation
  items: [...]
}
```

## 📝 Logs

Workflows and activities will log detailed steps:
- 🚀 Workflow started
- 📝 Create order
- 📦 Reserve inventory
- 💳 Process payment
- 📧 Send email
- 🔄 Compensation steps (if any)
- ✅❌ Final result

## ⚡ Performance & Scaling

### Worker Scaling

**Yes, running multiple workers helps process faster!**

- **Parallel Processing**: Each worker processes workflows/activities independently
- **Task Distribution**: Temporal automatically distributes tasks among workers
- **Throughput**: More workers = process more orders concurrently

**Example:**
- 1 worker: ~10 orders/minute
- 4 workers: ~40 orders/minute (4x)
- 8 workers: ~80 orders/minute (8x)

**Optimize number of workers:**
```bash
# Check CPU cores
nproc  # Linux
sysctl -n hw.ncpu  # macOS

# Recommendation: number of workers = CPU cores or 2x
# Example: 4 cores → 4-8 workers
```

**Monitor performance:**
- View number of running workflows on Temporal UI
- Check CPU/Memory usage
- Monitor task queue length

### Add New Activities

1. Create activity in `src/activities/order-activities.ts`
2. Export in `src/activities/index.ts`
3. Use in workflow `src/workflows/order-workflow.ts`
