import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators'
import {ExceptionInfo} from './trace.model';
import {createReport, dateNow} from './util';
import { SessionManager } from './session-manager.service';

@Injectable({ providedIn: 'root' })
export class HttpInterceptorService implements HttpInterceptor {

    constructor(private readonly sessionManager: SessionManager) { } // change this to session manager

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const start = dateNow();
        let status: number, responseBody: any = '', exception: ExceptionInfo;
        let id= crypto.randomUUID();
        req = req.clone({headers :req.headers.set('x-tracert',id)});
        //create req here and push to session queue
         const url = toHref(req.urlWithParams);
         const auth_user = this.extractAuthSchemeAnduser(req.headers);
          this.sessionManager.traceQueue.push({
            "@type":"http-req",
            id: id,
            method: req.method,
            protocol: url.protocol.slice(0, -1),
            host: exctractHost(url.host),
            port: +url.port || -1,
            path: url.pathname,
            query: url.search.slice(1, url.search.length),
            contentType: req.responseType,
            authScheme: auth_user.authScheme,
            user: auth_user.user,
            //status: +status,
            //inDataSize: sizeOf(responseBody),
            //ouDataSize: sizeOf(req.body),
            start: start,
            //end: dateNow(),
          })

        return next.handle(req).pipe(tap(
            (event: any) => {
                if (event instanceof HttpResponse) {
                    status = +event.status;
                    responseBody = event.body
                    this.assertSessionID(id, event.headers);
                }
            },
            error => {
                if(error){
                  this.assertSessionID(id, error?.headers);
                  status = +error.status;
                  exception = {
                    type : error.name,
                    message: error.error && error.status ?  JSON.stringify(error.error) : error.message
                  }
                } else {
                  status = 0;
                  exception = {
                    type: "ServerUnavailable",
                    message: "The remote server is unavailable or did not respond.",
                  };
                }
            },
        ), finalize(() => {
            try {
              if  (this.sessionManager.getCurrentSession()){
                const url = toHref(req.urlWithParams);
                const auth_user = this.extractAuthSchemeAnduser(req.headers);
                this.sessionManager.traceQueue.push({
                  "@type":"http-req",
                  id: id,
                  method: req.method,
                  protocol: url.protocol.slice(0, -1),
                  host: exctractHost(url.host),
                  port: +url.port || -1,
                  path: url.pathname,
                  query: url.search.slice(1, url.search.length),
                  contentType: req.responseType,
                  authScheme: auth_user.authScheme,
                  user: auth_user.user,
                  status: +status ||  0, // check if this is good
                  inDataSize: sizeOf(responseBody),
                  ouDataSize: sizeOf(req.body),
                  start: start,
                  end: dateNow(),
                  sessionId : this.sessionManager.currentSession.id
                });

               this.sessionManager.traceQueue.push(
                 {
                   "@type": "http-stg",
                   name: "PROCESS",
                   start: start,
                   end: dateNow(),
                   order: 0,
                   exception: exception,
                   requestId : id
                 }
               );
              }else{
                this.sessionManager.traceQueue.push(createReport("no active session found for instance: "+ this.sessionManager.instanceEnvironment.id))
              }
            }catch(err){
              console.warn(err);
              this.sessionManager.traceQueue.push(createReport(JSON.stringify(err)))
            }
        }));
    }

  assertSessionID(id:string, headers:any) {
    if(headers?.has('x-tracert')){
      if(id !== headers.get('x-tracert')){
        this.sessionManager.traceQueue.push(createReport("The received x-tracert header (" + headers.get('x-tracert') + ") does not match the request id (" + id + ") for instance: " + this.sessionManager.instanceEnvironment.id));
      }
    }
  }

  extractAuthSchemeAnduser(headers: any): {user: string | undefined, authScheme: string | undefined} {
    let auth_user: {user: string | undefined, authScheme: string | undefined} = {
      user: undefined,
      authScheme: undefined
    };
    try {
      auth_user.authScheme = headers.has('authorization') && headers.get('authorization').match(/^(\w+) /)?.at(1)
      switch (auth_user.authScheme){
        case "Basic":
          auth_user.user = atob(headers.get('authorization').split(" ")[1]).toString().split(':')[0];
          break;
        case "Bearer": {
          const parts = headers.get('authorization').split(" ")[1].split('.');
          if (parts.length == 3) {
            auth_user.user = JSON.parse(atob(parts[1]).toString()).sub;
          }
        }
      }
    }catch(err){
      console.warn(err);
      this.sessionManager.traceQueue.push(createReport(JSON.stringify(err)))
    }
    return auth_user;
  }
}


function toHref(url: string): HTMLAnchorElement {
    const href = document.createElement('a');
    href.setAttribute('href', url);
    return href;
}

function exctractHost(path: string) {
    const portregex = /:\d+/;
    return path.replace(portregex, '')
}

function sizeOf(body: any): number {
    return body ? JSON.stringify(body).length : 0;
}
