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
import {CollectorConfig, createInstance, TechnicalConf, validateAndGetConfig} from "./configuration";
import {
  eventTraceScheduledDispatcher,
} from "./event-trace-scheduled-dispatcher.service";

import { Router } from "@angular/router";
import { initUserActionMonitor } from "./user-action.monitor";
import { initNavigationMonitor } from './navigation.monitor';
import { initResourceUsageMonitor } from './resource-usage.monitor';
import { addReloadListener } from './event-bus';
import {sessionManager} from "./session-manager.service";
import {eventTraceDebugger} from "./event-trace-debugger";

const COLLECTOR_CONFIG = new InjectionToken<CollectorConfig>('COLLECTOR_CONFIG');

@NgModule()
export class NgCollectorModule {

  static forRoot(configuration: CollectorConfig): ModuleWithProviders<NgCollectorModule> {
    const providers = [];
    if (configuration?.enabled) {
      try {
        let tech  = InitializeContextManagerAndDispatcher(configuration);
        providers.push(
          { provide: COLLECTOR_CONFIG, useValue: tech },
          { provide: APP_INITIALIZER, useFactory: initializeEventsFactory, deps: [COLLECTOR_CONFIG, Router], multi: true },
          { provide: HTTP_INTERCEPTORS, useClass: HttpInterceptorService, deps:[COLLECTOR_CONFIG], multi: true },
          { provide: ErrorHandler, useClass: GlobalErrorHandler }
         );
      } catch (e: any) {
        console.warn(`invalid Configuration, Ng-collector is disabled because of this ${e.message}`);
      }
    }
    return {ngModule: NgCollectorModule, providers : providers}
  }
}

export function initializeEventsFactory(tech: TechnicalConf, router: Router) {
  return () => {
   if (tech.analytics) {
      initUserActionMonitor();
    }
    if (tech.resources) {
      initResourceUsageMonitor();
    }
    initNavigationMonitor(router);
    //storageEventListener();
    //eventTraceDebugger
    addReloadListener(e=>{
      //InitializeContextManagerAndDispatcher(tech)
    });
  }
}

export function InitializeContextManagerAndDispatcher(config: CollectorConfig) {
  console.log('Initializing Context Manager and Dispatcher with config', config)
  const id = crypto.randomUUID();
  const tech = validateAndGetConfig(config, id);
  const dispatch = eventTraceScheduledDispatcher(tech);
  dispatch.trace(createInstance(config, id));
  sessionManager(tech)
  return tech;
}


