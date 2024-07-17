import { NgModule, APP_INITIALIZER, ModuleWithProviders } from '@angular/core';
import { HTTP_INTERCEPTORS, } from '@angular/common/http';

import { logInspect } from './util';

import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { ApplicationConf, GetInstanceEnvironement, setConfig, validateAndGetConfig } from './configuration';
import { HttpInterceptorService } from './http-interceptor.service';
import { SessionManager } from './session-manager.service';
import { RouteTracerService } from './route-tracer.service';



@NgModule()
export class NgCollectorModule  {

  static forRoot(configuration: ApplicationConf): ModuleWithProviders<NgCollectorModule> {
    try{
      let conf = setConfig(configuration);
      if(conf.enabled){
        let config = validateAndGetConfig(conf);
        let instance = GetInstanceEnvironement(conf);
        console.log(conf)
        return {
          ngModule: NgCollectorModule,
          providers: [
            SessionManager, // to be removed  and add session manager instead 
            RouteTracerService,
            { provide: APP_INITIALIZER, useFactory: initializeRoutingEvents, deps: [SessionManager], multi: true },
            { provide: HTTP_INTERCEPTORS, useClass: HttpInterceptorService, multi: true },
            { provide: 'instance', useValue: instance },
            { provide: 'config', useValue: config }
          ]
        };
      }

    }catch(e){
      console.warn('invalid Configuration, Ng-collector is disabled because', e);
    }
    return {
      ngModule: NgCollectorModule
    }

    /*if (configuration?.enabled
        && matchRegex(host, HOST_PATERN)
        && matchRegex(getStringOrCall(configuration?.sessionApi), PATH_PATERN)
        && matchRegex(getStringOrCall(configuration?.instanceApi), PATH_PATERN)) {
       if(!requirePostitiveValue(getNumberOrCall(configuration?.delay),"delay") ||
          !requirePostitiveValue(getNumberOrCall(configuration?.bufferMaxSize),"bufferMaxSize") ){
            console.warn('invalid Configuration, Ng-collector is disabled');
          return {ngModule: NgCollectorModule}
       }  
    }*/
  }
}

export function initializeRoutingEvents(sessionManager: SessionManager) { 
  
  return () => {
        sessionManager.initialize();
  }
}


