import {
  NgModule,
  ModuleWithProviders,
  ErrorHandler,
  APP_INITIALIZER,
  InjectionToken
} from '@angular/core';
import { HTTP_INTERCEPTORS, } from '@angular/common/http';
import { HttpInterceptorService } from './http-interceptor.service';
import { GlobalErrorHandler } from "./global-error-handler.service";
import {ContextManager, ContextManger} from "./context-manager";
import { CollectorConfig } from "./configuration";
import {
  eventTraceScheduledDispatcher,
} from "./event-trace-scheduled-dispatcher.service";

import { eventTraceDebugger } from "./event-trace-debugger";
import { Router } from "@angular/router";
import { initUserActionMonitor } from "./user-action.monitor";
import { initNavigationMonitor } from './navigation.monitor';
import { initResourceUsageMonitor } from './resource-usage.monitor';
import { addReloadListener } from './event-bus';

export const COLLECTOR_CONFIG = new InjectionToken<CollectorConfig>('COLLECTOR_CONFIG');

@NgModule()
export class NgCollectorModule {

  static forRoot(configuration: CollectorConfig): ModuleWithProviders<NgCollectorModule> {
    const providers = [];
    if (configuration?.enabled) {
      try {
        providers.push(
          { provide: COLLECTOR_CONFIG, useValue: configuration },
          { provide: APP_INITIALIZER, useFactory: initializeEventsFactory, deps: [COLLECTOR_CONFIG, Router], multi: true },
          { provide: HTTP_INTERCEPTORS, useClass: HttpInterceptorService, multi: true },
          { provide: ErrorHandler, useClass: GlobalErrorHandler });
      } catch (e: any) {
        console.warn(`invalid Configuration, Ng-collector is disabled because of this ${e.message}`);
      }
    }
    return {ngModule: NgCollectorModule, providers : providers}
  }
}

export function initializeEventsFactory(config: CollectorConfig, router: Router) {
  return () => {
    ContextManger(config);
    eventTraceScheduledDispatcher();
    eventTraceDebugger();
    if (ContextManager.instance.techConfig.analytics) {
      initUserActionMonitor();
    }
    if (ContextManager.instance.techConfig.resources) {
      initResourceUsageMonitor();
    }
    initNavigationMonitor(router);
    //storageEventListener();
    addReloadListener(e=>{
      ContextManger(config);
      eventTraceScheduledDispatcher();
    });
  }
}


