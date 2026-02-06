import {
  NgModule,
  ModuleWithProviders,
  ErrorHandler,
  APP_INITIALIZER
} from '@angular/core';
import { HTTP_INTERCEPTORS, } from '@angular/common/http';
import { HttpInterceptorService } from './http-interceptor.service';
import { GlobalErrorHandler } from "./global-error-handler.service";
import { ContextManager } from "./context-manager";
import { CollectorConfig } from "./configuration";
import {
  eventTraceScheduledDispatcher,
} from "./event-trace-scheduled-dispatcher.service";

import { initUserActionMonitor } from "./user-action.monitor";
import { eventTraceDebugger } from "./event-trace-debugger";
import { Router } from "@angular/router";
import { initNavigationMonitor } from './navigation.monitor';
import { initResourceUsageMonitor } from './ressource-usage.monitor';

@NgModule()
export class NgCollectorModule {
  private static forRootCalled: boolean = false;
  static configuration: CollectorConfig;
  static forRoot(configuration: CollectorConfig): ModuleWithProviders<NgCollectorModule> {
    this.configuration = configuration;
    if (configuration?.enabled && !NgCollectorModule.forRootCalled) {
      NgCollectorModule.forRootCalled = true;
      try {
        ContextManager.init(configuration);
        return {
          ngModule: NgCollectorModule,
          providers: [
            //provideAppInitializer(initializeEvents),
            { provide: APP_INITIALIZER, useFactory: initializeEvents, deps: [Router], multi: true },
            { provide: HTTP_INTERCEPTORS, useClass: HttpInterceptorService, multi: true },
            { provide: ErrorHandler, useClass: GlobalErrorHandler }
          ]
        };
      } catch (e: any) {
        console.warn(`invalid Configuration, Ng-collector is disabled because of this ${e.message}`);
      }
    }
    return {
      ngModule: NgCollectorModule
    }
  }
}

export function initializeEvents(router: Router) {
  return () => {
    initContextManagerAndDispatcher();
    eventTraceDebugger();
    if (ContextManager.instance.techConfig.analytics) {
      initUserActionMonitor();
    }
    if (ContextManager.instance.techConfig.resources) {
      initResourceUsageMonitor();
    }
    initNavigationMonitor(router);
    //storageEventListener();
  }
}

export function initContextManagerAndDispatcher() {
  ContextManager.init(NgCollectorModule.configuration);
  eventTraceScheduledDispatcher();
}


