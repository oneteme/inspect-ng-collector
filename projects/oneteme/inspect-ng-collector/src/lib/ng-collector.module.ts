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

import { initAnalyticsModule } from "./analytics-collect.service";
import { eventTraceDebugger } from "./event-trace-debugger";
import { Router } from "@angular/router";
import { initNavigationModule } from './navigation.service';
import { initResourceUsageHandlerModule } from './machine-ressource-monitor.service';

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
      initAnalyticsModule();
    }
    if (ContextManager.instance.techConfig.resources) {
      initResourceUsageHandlerModule();
    }
    initNavigationModule(router);
    //storageEventListener();
  }
}

export function initContextManagerAndDispatcher() {
  ContextManager.init(NgCollectorModule.configuration);
  eventTraceScheduledDispatcher();
}


