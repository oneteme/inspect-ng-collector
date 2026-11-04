# @oneteme/inspect-ng-collector

[![npm version](https://img.shields.io/npm/v/@oneteme/inspect-ng-collector.svg)](https://www.npmjs.com/package/@oneteme/inspect-ng-collector)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Angular Version](https://img.shields.io/badge/Angular-%3E%3D16.2.8-red.svg)](https://angular.io)

A comprehensive **front-end telemetry and monitoring library for Angular applications**. Automatically collect user interactions, HTTP requests, navigation events, performance metrics, and errors—then send them to your backend analytics service.

## 🚀 Features

- **🔍 Comprehensive Event Tracking**
  - User interactions (clicks, form changes, scrolling)
  - HTTP requests and responses with full request/response details
  - Navigation and route changes
  - Global error handling and exceptions
  - Memory and resource usage metrics
  - Custom application events via `@TraceableStage()` decorator

- **📊 Session Management**
  - Automatic session creation per user navigation flow
  - Session correlation across multiple requests
  - Configurable session lifecycle

- **⚡ Performance Optimized**
  - In-memory event queue with configurable capacity
  - Batch export of events at regular intervals
  - Minimal impact on application performance
  - Tree-shakeable and side-effect free

- **🔐 Enterprise Ready**
  - Support for custom application properties
  - User identification integration
  - Environment and version tracking
  - Debug mode for development

## 📦 Installation

```bash
npm install @oneteme/inspect-ng-collector
```

### Peer Dependencies

- `@angular/common` >= 16.2.8
- `@angular/core` >= 16.2.8
- `@angular/router` >= 16.2.8

## 🔧 Quick Start

### 1. Import the Module

In your `app.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NgCollectorModule } from '@oneteme/inspect-ng-collector';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [ AppComponent ],
  imports: [ 
    BrowserModule,
    NgCollectorModule.forRoot({
      enabled: true,
      name: 'my-application',
      version: '1.0.0',
      env: 'production',
      tracing: {
        remote: {
          host: 'https://api.analytics.example.com'
        }
      }
    })
  ],
  bootstrap: [ AppComponent ]
})
export class AppModule { }
```

### 2. (Optional) Add Custom Tracing

Use the `@TraceableStage()` decorator to track custom application stages:

```typescript
import { Injectable } from '@angular/core';
import { TraceableStage } from '@oneteme/inspect-ng-collector';

@Injectable()
export class DataService {
  
  @TraceableStage()
  fetchUserData(userId: string) {
    // Your logic here
  }

  @TraceableStage()
  async processData(data: any) {
    // Async operations are supported
  }
}
```

### 3. (Optional) Log Application Events

```typescript
import { Injectable } from '@angular/core';
import { LogService } from '@oneteme/inspect-ng-collector';

@Injectable()
export class MyService {
  
  constructor(private logger: LogService) {}
  
  doSomething() {
    this.logger.info('Operation started');
    // ... operations ...
    this.logger.warn('Something unexpected');
    this.logger.error('An error occurred');
  }
}
```

## ⚙️ Configuration

### Full Configuration Example

```typescript
NgCollectorModule.forRoot({
  collector: {
    enabled: true,
    debugMode: false,
    application: {
      name: 'my-app',
      namespace: 'jarvis',
      version: () => getAppVersion(),
      env: 'production',
      user: 'john@example.com'
    },
    additionalProperties: () => ({
      customProperty: 'value',
      userId: getUserId()
    }),
    scheduling: {
      interval: 30000,                    // milliseconds; default: 60000
      queueCapacity: 1000
    },
    monitoring: {
      httpRoute: {
        excludes: {
          path: [/\/health$/, /\/status$/]
        }
      },
      httpRequest: {
        excludes: {
          host: ['localhost:4200']
        }
      },
      resources: { enabled: true },
      analytics: { enabled: true },
      logger: { enabled: true },          // Capture console.warn and console.error
      reporter: { enabled: true },        // Send internal collector reports
      storage: { enabled: false }
    },
    tracing: {
      remote: {
        host: 'https://analytics.example.com',
        mode: 'cors',
        token: () => getCollectorToken(),
        retentionMaxAge: { audit: 7, diagnostics: 10 }
      }
    }
  }
})
```

### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `collector.enabled` | boolean | false | Enable/disable collection |
| `collector.debugMode` | boolean | false | Enable debug output |
| `collector.application.name` | string \| function | required | Application name |
| `collector.application.namespace` | string \| function | required | Application namespace |
| `collector.application.env` | string \| function | required | Environment (prod, dev, etc.) |
| `collector.application.user` | string \| function | optional | Current user identifier |
| `collector.scheduling.interval` | number | 60000 | Event export interval (ms) |
| `collector.scheduling.queueCapacity` | number | 1000 | Maximum queued traces |
| `collector.monitoring.resources.enabled` | boolean | false | Track memory metrics |
| `collector.monitoring.analytics.enabled` | boolean | false | Track user interactions |
| `collector.monitoring.logger.enabled` | boolean | false | Capture `console.warn()` and `console.error()` calls |
| `collector.monitoring.reporter.enabled` | boolean | false | Send internal collector reports |
| `collector.tracing.remote.host` | string | `http://localhost` | Backend analytics endpoint |
| `collector.tracing.remote.token` | string \| function | empty | Backend authentication token |

Console capture covers `warn` and `error`, not `log` or `info`. Captured messages are sent to the configured backend, so avoid logging secrets or other sensitive values.

## 📊 Collected Data

The library automatically collects:

- **Navigation Events**: Route changes, page loads, back/forward navigation
- **HTTP Events**: 
  - Request details (method, URL, headers, body size)
  - Response details (status, content-type, duration)
  - Request failures and network errors
- **User Actions**: Clicks, form inputs, scrolling, drag operations
- **Errors**: Uncaught exceptions, Angular error handler events
- **Performance**: JavaScript memory usage, resource timing
- **Custom Traces**: Any method decorated with `@TraceableStage()`
- **Application Logs**: Via `LogService.info()`, `.warn()`, `.error()`

All events are **correlated by session** and sent to your backend service.

## 🎯 Exported API

### NgCollectorModule

Main module for integration.

```typescript
NgCollectorModule.forRoot(config: CollectorConfig): ModuleWithProviders
```

### TraceableStage

Decorator for tracking custom method execution:

```typescript
@TraceableStage()
myMethod() { }
```

Supports both synchronous and asynchronous methods.

### SessionManager

Service managing user sessions (injected automatically).

```typescript
import { SessionManager } from '@oneteme/inspect-ng-collector';
```

### LogService

Service for application logging:

```typescript
import { LogService } from '@oneteme/inspect-ng-collector';

constructor(private logger: LogService) {}

this.logger.info('message');
this.logger.warn('message');
this.logger.error('message');
```

### COLLECTOR_CONFIG

Injection token for accessing collector configuration:

```typescript
import { COLLECTOR_CONFIG } from '@oneteme/inspect-ng-collector';

constructor(@Inject(COLLECTOR_CONFIG) config: any) { }
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         Angular Application                 │
│  (Components, Services, HTTP calls)         │
└──────────────┬──────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────────────┐
        │      EventBus (Internal Event System)           │
        │  Receives events from monitors and services     │
        └──────┬──────────────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────────────┐
        │      Session Manager & Monitors                 │
        │  • Navigation Monitor                           │
        │  • HTTP Interceptor                             │
        │  • User Action Monitor                          │
        │  • Resource Usage Monitor                       │
        │  • Global Error Handler                         │
        └──────┬──────────────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────────────┐
        │      Event Queue (In-Memory)                    │
        │  Batches and buffers events                     │
        └──────┬──────────────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────────────┐
        │      Scheduled Dispatcher                       │
        │  Sends events to backend at intervals           │
        └──────┬──────────────────────────────────────────┘
               │
        ┌──────▼──────────────────────────────────────────┐
        │  Analytics Backend (Your Service)               │
        │  https://analytics.example.com/api              │
        └─────────────────────────────────────────────────┘
```

## 🐛 Debug Mode

Enable debug mode in configuration to see internal events logged to the browser console:

```typescript
NgCollectorModule.forRoot({
  // ...
  debugMode: true
})
```

This will show:
- Event creation and dispatching
- Session lifecycle
- Network requests to backend
- Internal state changes

## 🔒 Security

This library respects user privacy and security:

- Events are sent only to configured backend endpoints
- No external requests outside your configured domain
- Supports CORS and custom headers
- Sensitive information (credentials) excluded from HTTP tracking
- No local persistence of sensitive data

### Excluding Sensitive Endpoints

```typescript
monitoring: {
  httpRoute: {
    excludes: {
      path: [
        /\/api\/login$/,
        /\/api\/password-reset$/,
        /\/api\/tokens?$/
      ]
    }
  }
}
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Made with ❤️ by [u$f](https://oneteme.github.io/) and contributors**
