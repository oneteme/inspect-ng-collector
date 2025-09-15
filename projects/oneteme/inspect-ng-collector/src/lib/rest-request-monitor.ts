import {ExceptionInfo, RestRequest} from "./trace.model";
import {createReport, dateNow} from "./util";
import {HttpRequest, HttpResponse} from "@angular/common/http";
import {SessionManager} from "./session-manager.service";
import {EventTraceScheduledDispatcherService} from "./event-trace-scheduled-dispatcher.service";

export class RestRequestMonitor{
    restRequest: RestRequest;

    constructor(private readonly sessionManager: SessionManager,
                restRequest: HttpRequest<any>,
                private readonly dispatcher: EventTraceScheduledDispatcherService){
      const start = dateNow();
      const url = toHref(restRequest.urlWithParams);
      const auth_user = extractAuthSchemeAnduser(restRequest.headers);

      this.restRequest = {
        "@type":"http-req",
        id: crypto.randomUUID(),
        method: restRequest.method,
        protocol: url.protocol.slice(0, -1),
        host: exctractHost(url.host),
        port: +url.port || -1,
        path: url.pathname,
        query: url.search.slice(1, url.search.length),
        contentType: restRequest.responseType,
        authScheme: auth_user.authScheme,
        user: auth_user.user,
        ouDataSize: sizeOf(restRequest.body),
        start: start,
        sessionId: sessionManager.currentSessionID()
      };
      this.dispatcher.addToQueue(this.restRequest);
    }

    postProcess(event: HttpResponse<any> | null, error: any) {
      let status: number=0, responseBody: any = '', exception: ExceptionInfo | null = null; // tobe changed
      if(event){
        status = +event.status;
        this.restRequest.inDataSize = sizeOf(event.body);

        this.assertSessionID(this.restRequest.id, event.headers);
      }
      if(error){
        this.assertSessionID(this.restRequest.id, error?.headers);
        status = +error.status;
        exception = {
          type : error.name,
          message: error.error && error.status ?  JSON.stringify(error.error) : error.message
        }
      }
      this.restRequest.end= dateNow();
      this.restRequest.status = +status;

      let stage = {
        "@type": "http-stg",
        name: "PROCESS",
        start: this.restRequest.start,
        end: dateNow(),
        order: 0,
        exception: exception,
        requestId : this.restRequest.id
      }

      this.dispatcher.addToQueue(this.restRequest);
      this.dispatcher.addToQueue(stage);
    }

  assertSessionID(id:string, headers:any) {
    if(headers?.has('x-tracert')){
      if(id !== headers.get('x-tracert')){
        console.log(id, headers.get('x-tracert'))
        this.dispatcher.addToQueue(createReport("The received x-tracert header (" + headers.get('x-tracert') + ") does not match the request id (" + id + ") for instance: " + this.dispatcher.instanceEnvironment.id));
      }
    }
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

export function extractAuthSchemeAnduser(headers: any): {user: string | undefined, authScheme: string | undefined} {
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
  //  this.sessionManager.traceQueue.push(createReport(JSON.stringify(err)))
  }
  return auth_user;
}


function sizeOf(body: any): number {
  return body ? JSON.stringify(body).length : 0;
}
