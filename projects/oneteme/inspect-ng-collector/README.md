# @oneteme/inspect-ng-collector

[![npm version](https://img.shields.io/npm/v/@oneteme/inspect-ng-collector.svg)](https://www.npmjs.com/package/@oneteme/inspect-ng-collector)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Angular Version](https://img.shields.io/badge/Angular-%3E%3D16.2.8-red.svg)](https://angular.io)
[![Tests](https://img.shields.io/badge/Tests-150%2B%20Cases-brightgreen.svg)](#testing)

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

- **🧪 Fully Tested**
  - 150+ unit test cases
  - 80%+ code coverage
  - Comprehensive test documentation

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
  // Core Configuration
  enabled: true,                          // Enable/disable collection
  debugMode: false,                       // Enable debug console output
  
  // Application Identity (at root level)
  name: 'my-app',
  version: () => getAppVersion(),        // Can be a function
  env: 'production',
  user: 'john@example.com',              // Optional user identifier
  
  // Additional Properties
  additionalProperties: () => ({
    customProperty: 'value',
    userId: getUserId()
  }),
  
  // Scheduling
  scheduling: {
    interval: 30000                      // Export interval in ms (default: 30s)
  },
  
  // Monitoring Configuration
  monitoring: {
    // HTTP Monitoring
    httpRoute: {
      excludes: {
        path: [/\/health$/, /\/status$/]  // Exclude paths from tracking
      }
    },
    httpRequest: {
      excludes: {
        host: ['localhost:4200']          // Exclude hosts
      }
    },
    // Features
    resources: {
      enabled: true                       // Track memory usage
    },
    analytics: {
      enabled: true                       // Track user actions
    },
    storage: {
      enabled: false                      // Track storage events
    }
  },
  
  // Tracing Configuration
  tracing: {
    queueCapacity: 1000,                  // Max events in queue
    remote: {
      host: 'https://analytics.example.com',
      mode: 'cors',
      retentionMaxAge: 86400000           // 24 hours
    }
  }
})
```

### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | boolean | false | Enable/disable collection |
| `debugMode` | boolean | false | Enable debug output |
| `name` | string \| function | required | Application name |
| `version` | string \| function | optional | Application version |
| `env` | string \| function | optional | Environment (prod, dev, etc.) |
| `user` | string \| function | optional | Current user identifier |
| `additionalProperties` | function | optional | Custom app properties |
| `scheduling.interval` | number | 30000 | Event export interval (ms) |
| `monitoring.resources.enabled` | boolean | false | Track memory metrics |
| `monitoring.analytics.enabled` | boolean | false | Track user interactions |
| `tracing.queueCapacity` | number | 1000 | Max queued events |
| `tracing.remote.host` | string | required | Backend analytics endpoint |

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
