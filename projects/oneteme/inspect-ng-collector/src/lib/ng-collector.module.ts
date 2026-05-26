import {
  NgModule,
  ModuleWithProviders,
  ErrorHandler,
  APP_INITIALIZER,
  InjectionToken, Provider
} from '@angular/core';
import { HTTP_INTERCEPTORS, } from '@angular/common/http';
import { HttpInterceptorService } from './http-interceptor.service';
import { GlobalErrorHandler } from "./global-error-handler.service";
import {
  CollectorConfig,
  createInstance, refreshConfig,
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
import {addReloadListener, dispatchReport} from './event-bus';
import {sessionManager} from "./session-manager.service";
import {eventTraceDebugger} from "./event-trace-debugger";
import {InstanceEnvironment, UUID} from "./trace.model";

const COLLECTOR_CONFIG = new InjectionToken<CollectorConfig>('COLLECTOR_CONFIG');

@NgModule()
export class NgCollectorModule {

  static forRoot(configuration: CollectorConfig): ModuleWithProviders<NgCollectorModule> {
    const providers: Provider[] = [];
    if (configuration?.enabled) {
      try {
        let config  = initializeCollector(configuration);
        providers.push(
          { provide: COLLECTOR_CONFIG, useValue: config },
          { provide: APP_INITIALIZER,  useFactory: initializeEventsFactory, deps: [COLLECTOR_CONFIG, Router], multi: true },
          { provide: HTTP_INTERCEPTORS, useClass: HttpInterceptorService, deps:[COLLECTOR_CONFIG], multi: true },
          { provide: ErrorHandler, useClass: GlobalErrorHandler }
         );
      } catch (e: any) {
        console.warn(`invalid Configuration, Ng-collector is disabled because of this ${e.message}`);
      }
    }
    console.log("INSPECT", providers);
    return {ngModule: NgCollectorModule, providers : providers}
  }
}


export function initializeEventsFactory(config: {tech: TechnicalConf, instance: InstanceEnvironment }, router: Router) {

  console.log(`initializeEventsFactory1`);
  return () => {
    console.log(`initializeEventsFactory2`);
    return new Promise(resolve => {
      console.log(`initializeEventsFactory3`);

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
      return '';
    })
  }
}

export function initializeCollector(config: CollectorConfig) {
  const id = (crypto as any).randomUUID() as UUID;
  const tech = validateAndGetConfig(config, id);
  const dispatch = eventTraceScheduledDispatcher(tech);
  const instance = createInstance(config, id)
  dispatch.trace(instance);
  sessionManager(tech);
  dispatchReport('collector_initialized');
  return {tech: tech, instance: instance};
}

export function reloadCollector(config: {tech: TechnicalConf, instance: InstanceEnvironment }) {
  const id = (crypto as any).randomUUID() as UUID;
  refreshConfig(id, config.tech);
  const dispatch = eventTraceScheduledDispatcher(config.tech);
  config.instance.id= id;
  dispatch.trace(config.instance);
  sessionManager(config.tech)
}


