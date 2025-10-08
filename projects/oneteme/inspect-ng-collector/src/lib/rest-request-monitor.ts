import {ExceptionInfo, RestRequest} from "./trace.model";
import {createReport, dateNow, DISPATCH, RequestMask} from "./util";
import {HttpRequest, HttpResponse} from "@angular/common/http";
import {SessionManager} from "./session-manager.service";

export class RestRequestMonitor{

    readonly restRequest: RestRequest;

    constructor(restRequest: HttpRequest<any>){
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
        sessionId: SessionManager.instance.currentSessionID()
      };
      SessionManager.instance.updateMask(RequestMask.REST);
    }

    postProcess(event: HttpResponse<any> | null, error: any) {
      let status: number=0, exception: ExceptionInfo | null = null;
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

      window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : this.restRequest } }));
      window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : stage } }));
    }

  assertSessionID(id:string, headers:any) {
    if(headers?.has('x-tracert')){
      if(id !== headers.get('x-tracert')){
        window.dispatchEvent(new CustomEvent( DISPATCH,
          {
            detail :  { traces : createReport("The received x-tracert header (" + headers.get('x-tracert') + ") does not match the request id (" + id + ")") }
          }));
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
    createReport(JSON.stringify(err));
  }
  return auth_user;
}


function sizeOf(body: any): number {
  return body ? JSON.stringify(body).length : 0;
}
