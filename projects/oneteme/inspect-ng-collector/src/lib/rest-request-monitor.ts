import {ExceptionInfo, RestRequest, RestRequestCallBack} from "./trace.model";
import {createReport, dateNow, DISPATCH, RequestMask} from "./util";
import {HttpErrorResponse, HttpRequest, HttpResponse} from "@angular/common/http";
import {SessionManager} from "./session-manager.service";

export class RestRequestMonitor{

    readonly restRequest: RestRequest;
    readonly restRequestCallBack: RestRequestCallBack;
    constructor(restRequest: HttpRequest<any>){
      const start = dateNow();
      const url = toHref(restRequest.urlWithParams);
      const auth_user = extractAuthSchemeAnduser(restRequest.headers);
      this.restRequest = {
        "@type":"120",
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
        dataSize: sizeOf(restRequest.body),
        start: start,
        sessionId: SessionManager.instance.currentSessionID()
      };
      SessionManager.instance.updateMask(RequestMask.REST);
      this.restRequestCallBack = {
        "@type":"121",
        id : this.restRequest.id,
        dataSize: -1,
        linked: false
      }
    }

    postProcess(event: HttpResponse<any> | null, error: any) {
      let status: number=0, exception: ExceptionInfo | null = null;
      if(event){
        status = +event.status;
        this.restRequestCallBack.dataSize = sizeOf(event.body);
        this.restRequestCallBack.linked = this.assertSessionID(this.restRequest.id, event.headers);
      }
      if(error){
        this.restRequestCallBack.linked = error?.headers && this.assertSessionID(this.restRequest.id, error.headers);
        status = +error.status;
        exception = {
          type : error.name,
          message: error.error && error.status ?  JSON.stringify(error.error) : error.message
        }
        this.restRequestCallBack.bodyContent = error instanceof HttpErrorResponse? JSON.stringify(error.error): undefined;
        this.restRequestCallBack.dataSize = sizeOf(error.error)
      }

      this.restRequestCallBack.contentType = extractContentType((<any>event)?.headers)
      this.restRequestCallBack.end= dateNow();
      this.restRequestCallBack.status = +status;

      let stage = {
        "@type": "220",
        name: "PROCESS",
        start: this.restRequest.start, //  use request
        end: dateNow(),
        order: 0,
        exception: exception,
        requestId : this.restRequestCallBack.id
      }
      window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : this.restRequestCallBack } }));
      window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : stage } }));
    }

  assertSessionID(id:string, headers:any) {
    if(headers?.has('x-tracert')){
      if(id == headers.get('x-tracert')){
          return true;
      }
      window.dispatchEvent(new CustomEvent( DISPATCH,
        {
          detail :  { traces : createReport("The received x-tracert header (" + headers.get('x-tracert') + ") does not match the request id (" + id + ")") }
        }));
    }
    return false;
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

export function extractContentType(headers: any): string | undefined {
  try {
    if(headers?.has('Content-Type')){
      return headers.get('Content-Type');
    }
  }catch(err){
    createReport(JSON.stringify(err));
  }
  return undefined;
}


function sizeOf(body: any): number {
  return body ? JSON.stringify(body).length : 0;
}
