# 📝 `LogService`

## Description

The `LogService` allows you to **send custom logs** from your Angular application to the trace collection system. Logs are automatically associated with the current user session.

## Why use it?

- 📊 **Log centralization**: All your logs are collected with the other application traces
- 🔗 **Traceability**: Each log is associated with the current user session
- 🎯 **Severity levels**: INFO, WARN, ERROR to categorize your messages
- 🚀 **Simplicity**: Static usage, no dependency injection needed

## Installation

```typescript
import { LogService } from '@oneteme/inspect-ng-collector';
```

## Usage

```typescript
// Information log
LogService.info("User logged in successfully");

// Warning log
LogService.warn("Request took more than 3 seconds");

// Error log
LogService.error("Form validation failed");
```

## Available log levels

| Method | Level | Use case |
|--------|-------|----------|
| `LogService.info()` | INFO | User actions, normal events |
| `LogService.warn()` | WARN | Unusual behaviors, degradations |
| `LogService.error()` | ERROR | Application errors, failures |

## What is collected

| Information | Description |
|-------------|-------------|
| **Level** | INFO, WARN or ERROR |
| **Message** | The log text |
| **Session** | Current user session ID |
| **Timestamp** | Date and time of the log |

## Use cases

✅ **Ideal for:**
- Tracing important user actions (login, validation, etc.)
- Logging business warnings
- Capturing custom application errors
- Adding context to automatic traces

## Concrete example

```typescript
@Component({...})
export class CheckoutComponent {

  onPaymentSuccess(orderId: string) {
    LogService.info(`Payment validated for order ${orderId}`);
  }

  onPaymentRetry() {
    LogService.warn("User retried payment after a failure");
  }

  onPaymentError(error: string) {
    LogService.error(`Payment failed: ${error}`);
  }
}
```

These logs will be collected and visible in your monitoring dashboard, associated with the user session.

## 💡 Best practices

- Use **INFO** for normal events in the user journey
- Use **WARN** for unusual but non-blocking situations
- Use **ERROR** for errors that impact user experience
- Include contextual information in your messages (IDs, values, etc.)

