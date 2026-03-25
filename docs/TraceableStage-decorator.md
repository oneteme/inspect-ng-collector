# 🎯 `@TraceableStage()` Decorator

## Description

The `@TraceableStage()` decorator allows you to **automatically trace the execution of your methods** in your Angular application. It integrates with the trace collection system to monitor performance and detect errors.

## Why use it?

- 📊 **Performance monitoring**: Automatically measures the execution time of your methods
- 🐛 **Error detection**: Captures exceptions without impacting your code behavior
- 🔗 **Traceability**: Associates each call with the current user session
- 🚀 **Simplicity**: A single annotation is enough, no code to add in your methods

## Installation

```typescript
import { TraceableStage } from '@oneteme/inspect-ng-collector';
```

## Usage

Simply add the decorator to the methods you want to trace:

```typescript
@Component({...})
export class MyComponent {

  @TraceableStage()
  processData(data: any) {
    // Your business logic
    return this.transform(data);
  }

  @TraceableStage()
  calculateTotal(items: Item[]) {
    return items.reduce((sum, item) => sum + item.price, 0);
  }
}
```

## What is collected

| Information | Description |
|-------------|-------------|
| **Method name** | Identifies which method was called |
| **Class** | The class containing the method |
| **Execution time** | Duration between the start and end of the call |
| **User** | The current session user |
| **Exception** | Type and message if an error occurs |

## Use cases

✅ **Ideal for:**
- Tracing important business calculations
- Monitoring data transformations
- Detecting slow methods
- Capturing errors in application logic

⚠️ **Limitations:**
- Works with **synchronous** methods only
- For HTTP calls, use the built-in HTTP interceptor instead

## Concrete example

```typescript
@Injectable()
export class OrderService {

  @TraceableStage()
  validateOrder(order: Order): boolean {
    // Complex validation
    return order.items.length > 0 && order.total > 0;
  }

  @TraceableStage()
  applyDiscount(order: Order, discountCode: string): Order {
    // Apply a discount
    const discount = this.getDiscount(discountCode);
    order.total = order.total * (1 - discount);
    return order;
  }
}
```

These methods will be automatically traced and you can visualize their performance in your monitoring dashboard.

