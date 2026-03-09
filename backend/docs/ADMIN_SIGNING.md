# Admin Signing Service

This document describes the admin signing service and best practices for handling admin/operator keys in the backend.

## Overview

The admin signing service isolates admin operations behind a clear service boundary and enforces security best practices:

- **Feature flag protection**: Admin signing is disabled by default (`SOROBAN_ADMIN_SIGNING_ENABLED=false`)
- **Operation whitelist**: Only specific operations can be executed with admin keys
- **Audit logging**: All admin operations are logged (no secrets included)
- **Service boundary**: Admin operations are isolated from general request handlers

## Admin Operations

The following operations require admin signing and are controlled by the `AdminSigningService`:

1. **`pause`** - Pause a contract (emergency stop)
2. **`unpause`** - Unpause a contract (resume operations)
3. **`set_operator`** - Set or clear the operator address for a contract
4. **`init`** - Initialize a contract (if done via backend)

### Operation Signatures

- `pause(contractId: string): Promise<string>` - Returns transaction hash
- `unpause(contractId: string): Promise<string>` - Returns transaction hash
- `setOperator(contractId: string, operatorAddress: string | null): Promise<string>` - Returns transaction hash
- `init(contractId: string, adminAddress: string, operatorAddress?: string): Promise<string>` - Returns transaction hash

## Configuration

### Environment Variables

```bash
# Required: Admin secret key for signing transactions
SOROBAN_ADMIN_SECRET=your_admin_secret_key_here

# Required: Feature flag to enable admin signing (default: false)
SOROBAN_ADMIN_SIGNING_ENABLED=true
```

### Security Considerations

1. **Feature Flag**: Admin signing is **disabled by default**. Set `SOROBAN_ADMIN_SIGNING_ENABLED=true` only when admin operations are needed.

2. **Secret Management**: 
   - Admin secrets should be stored securely (e.g., environment variables, secret management systems)
   - Never log or expose admin secrets
   - Rotate admin secrets regularly

3. **Access Control**: 
   - Admin operations should only be triggered by:
     - Admin-only API endpoints (protected by authentication/authorization)
     - Background jobs with proper access controls
     - Manual scripts run by authorized personnel

## Usage

### Enabling Admin Signing

```typescript
// In environment configuration
SOROBAN_ADMIN_SIGNING_ENABLED=true
SOROBAN_ADMIN_SECRET=your_admin_secret_key
```

### Using Admin Operations

```typescript
import { RealSorobanAdapter } from './soroban/real-adapter.js'

const adapter = new RealSorobanAdapter(config)

// Pause a contract
const txHash = await adapter.pause(contractId)

// Unpause a contract
const txHash = await adapter.unpause(contractId)

// Set operator
const txHash = await adapter.setOperator(contractId, operatorAddress)

// Clear operator (set to null)
const txHash = await adapter.setOperator(contractId, null)

// Initialize contract
const txHash = await adapter.init(contractId, adminAddress, operatorAddress)
```

## Audit Logging

All admin operations are automatically logged with the following information:

- **Timestamp**: When the operation was executed
- **Operation**: The operation name (pause, unpause, set_operator, init)
- **Contract ID**: The contract being operated on
- **Admin Public Key**: The public key of the admin (derived from secret)
- **Transaction Hash**: The on-chain transaction hash (on success)
- **Success/Failure**: Whether the operation succeeded
- **Error**: Error message if the operation failed

**Important**: No secrets are included in audit logs. Only the public key is logged.

### Example Audit Log Entry

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "operation": "pause",
  "contractId": "C...",
  "adminPublicKey": "G...",
  "transactionHash": "abc123...",
  "success": true
}
```

## Best Practices

### 1. Do NOT Use Admin Secrets in General Request Handlers

❌ **Bad**: Admin operations triggered by user requests
```typescript
// DON'T: Allow any user request to trigger admin operations
app.post('/api/user/action', async (req, res) => {
  await adapter.pause(contractId) // DANGEROUS!
})
```

✅ **Good**: Admin operations isolated to admin-only endpoints
```typescript
// DO: Protect admin operations behind authentication/authorization
app.post('/api/admin/pause', requireAdminAuth, async (req, res) => {
  await adapter.pause(contractId) // Safe - requires admin auth
})
```

### 2. Use Feature Flags

Always check the feature flag before enabling admin operations:

```typescript
if (!env.SOROBAN_ADMIN_SIGNING_ENABLED) {
  throw new Error('Admin signing is disabled')
}
```

### 3. Implement Proper Access Control

Admin operations should be protected by:
- Authentication (verify user identity)
- Authorization (verify user has admin role)
- Rate limiting (prevent abuse)
- Audit trails (log who did what)

### 4. Isolate Admin Operations

Create dedicated admin endpoints or background jobs for admin operations:

```typescript
// Admin-only route
app.post('/api/admin/contracts/:contractId/pause', 
  requireAdminAuth,
  async (req, res) => {
    const { contractId } = req.params
    const txHash = await adapter.pause(contractId)
    res.json({ transactionHash: txHash })
  }
)
```

### 5. Monitor Admin Operations

Set up alerts for:
- Unusual admin operation patterns
- Failed admin operations
- Admin operations outside business hours

## Non-Admin Operations

### `recordReceipt`

The `recordReceipt` operation is **NOT** an admin operation. It's a regular operation that records transaction receipts.

**Current Implementation**: `recordReceipt` currently uses the admin secret for signing, but this is a legacy implementation. In the future, this may be refactored to use:
- Operator key (if operator is configured)
- Dedicated receipt-signing key
- User-signed transactions

**Note**: `recordReceipt` does not require `SOROBAN_ADMIN_SIGNING_ENABLED=true` because it's not an admin operation.

## Error Handling

The admin signing service throws specific errors:

- `ConfigurationError`: When admin signing is disabled or admin secret is missing
- `TransactionError`: When the on-chain transaction fails
- `ContractError`: When the contract rejects the operation

Always handle these errors appropriately:

```typescript
try {
  const txHash = await adapter.pause(contractId)
  logger.info('Contract paused', { txHash })
} catch (err) {
  if (err instanceof ConfigurationError) {
    logger.error('Admin signing not configured', { error: err.message })
  } else if (err instanceof TransactionError) {
    logger.error('Transaction failed', { error: err.message, txHash: err.txHash })
  } else {
    logger.error('Unexpected error', { error: err })
  }
  throw err
}
```

## Testing

When testing admin operations:

1. Use a test admin secret (never use production secrets in tests)
2. Mock the admin signing service in unit tests
3. Use integration tests with a test network for end-to-end testing
4. Verify audit logs are generated correctly

## Migration Guide

If you're migrating from the old admin secret usage:

1. **Enable the feature flag**: Set `SOROBAN_ADMIN_SIGNING_ENABLED=true`
2. **Update code**: Replace direct `invokeTransaction` calls with admin operation methods
3. **Add access control**: Ensure admin operations are behind proper authentication/authorization
4. **Review audit logs**: Verify all admin operations are being logged

## Related Documentation

- [Soroban Integration Tests](./soroban-integration-tests.md)
- [Webhook Signature Verification](./WEBHOOK_SIGNATURE_VERIFICATION.md)
- [Contract Conventions](../docs/specs/contracts/CONVENTIONS.md)
