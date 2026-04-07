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
import {
  CollectorConfig,
  createInstance, refreshConfig, refreshInstance,
  TechnicalConf,
  validateAndGetConfig
} from "./configuration";
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
import {InstanceEnvironment} from "./trace.model";

const COLLECTOR_CONFIG = new InjectionToken<CollectorConfig>('COLLECTOR_CONFIG');

@NgModule()
export class NgCollectorModule {

  static forRoot(configuration: CollectorConfig): ModuleWithProviders<NgCollectorModule> {
    const providers = [];
    if (configuration?.enabled) {
      try {
        let config  = initializeCollector(configuration);
        providers.push(
          { provide: COLLECTOR_CONFIG, useValue: config },
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

export function initializeEventsFactory(config: {tech: TechnicalConf, instance: InstanceEnvironment }, router: Router) {
  return () => {
   if (config.tech.analytics) {
      initUserActionMonitor();
    }
    if (config.tech.resources) {
      initResourceUsageMonitor();
    }
    initNavigationMonitor(router);
    //storageEventListener();
    //eventTraceDebugger
    addReloadListener(e=>{
        reloadCollector(config)
    });
  }
}

export function initializeCollector(config: CollectorConfig) {
  const id = crypto.randomUUID();
  const tech = validateAndGetConfig(config, id);
  const dispatch = eventTraceScheduledDispatcher(tech);
  const instance = createInstance(config, id)
  dispatch.trace(instance);
  sessionManager(tech)
  return {tech: tech, instance: instance};
}

export function reloadCollector(config: {tech: TechnicalConf, instance: InstanceEnvironment }) {
  const id = refreshConfig(config.tech);
  const dispatch = eventTraceScheduledDispatcher(config.tech);
  config.instance.id= id;
  dispatch.trace(refreshInstance(config.instance));
  sessionManager(config.tech)
}


