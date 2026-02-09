import { dateNow, ExceptionInfo, HttpRequestStage, RestRequest, RestRequestCallBack, RequestMask, UUID } from "./trace.model";
import { dispatchTraces, dispatchReport } from "./event-bus";
import { HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse } from "@angular/common/http";
import { SessionManager } from "./session-manager.service";

export const TRACE_HEADER = 'x-tracert';

export class RestRequestMonitor {

  readonly id: UUID;
  readonly start: number;

  constructor() {
    this.start = dateNow();
    this.id = crypto.randomUUID();
  }

  preProcess(restRequest: HttpRequest<any>) {
    const url = new URL(restRequest.urlWithParams, window.location.origin); //TDO check & remove toHref(restRequest.urlWithParams)
    const auth_user = extractAuthSchemeAnduser(restRequest.headers);
    dispatchTraces({...SessionManager.instance.initRestRequest(RequestMask.REST),
      "@type": '121', //TODO create constants
      id: this.id,
      method: restRequest.method,
      protocol: url.protocol.slice(0, -1),
      host: exctractHost(url.host),
      port: +url.port || -1, //TODO +undefined => 0 || -1 => -1
      path: url.pathname,
      query: url.search.slice(1, url.search.length),
      contentType: restRequest.responseType,
      authScheme: auth_user.authScheme,
      user: auth_user.user,
      dataSize: sizeOf(restRequest.body),
      start: this.start,
    } as RestRequest);
  }

  postProcess(event: HttpResponse<any> | null, error: any) { //TODO see HttpResponseBase 
    const end = dateNow();
    const callback: RestRequestCallBack = {
      "@type": "121",  //TODO create constants
      id: this.id,
      dataSize: -1,
      linked: false,
      end: end
    }
    let status: number = 0, exception!: ExceptionInfo;
    if (event) {
      status = +event.status;
      callback.dataSize = sizeOf(event.body);
    }
    if (error) {
      status = +error.status;
      exception = {
        type: error.name,
        message: error.error && error.status ? JSON.stringify(error.error) : error.message
      }
      callback.bodyContent = error instanceof HttpErrorResponse ? JSON.stringify(error.error) : undefined;
      callback.dataSize = sizeOf(error.error);
    }
    const headers: HttpHeaders = (event || error).headers;
    if (headers) {
      callback.linked = assertSessionID(this.id, headers);
      callback.contentType = extractContentType(headers);
    }
    callback.status = +status;
    dispatchTraces(callback, {
      "@type": '220',
      name: "PROCESS",
      start: this.start, //  use request
      end: end,
      order: 0,
      exception: exception,
      requestId: this.id
    } as HttpRequestStage);
  }
}

function assertSessionID(id: string, headers: HttpHeaders) { //browser cache !?
  return headers?.get(TRACE_HEADER) == id;
}

//deprecated 
function toHref(url: string): HTMLAnchorElement {
  const href = document.createElement('a');
  href.setAttribute('href', url);
  return href;
}

function exctractHost(path: string) {
  const portregex = /:\d+/;
  return path.replace(portregex, '')
}

function extractAuthSchemeAnduser(headers: any): { user: string | undefined, authScheme: string | undefined } {
  const scheme = headers.has('authorization') && headers.get('authorization').match(/^(\w+) /)?.at(1);
  return {
    authScheme: scheme,
    user: extractUser(scheme, headers.get('authorization').split(" ")[1])
  }
}

function extractUser(scheme: 'Basic' | 'Bearer', authorization: string) {
  try {
    switch (scheme) {
      case "Basic": return atob(authorization).toString().split(':')[0];
      case "Bearer": {
        const parts = authorization.split('.');
        if (parts.length == 3) {
          return JSON.parse(atob(parts[1]).toString()).sub; //TODO regex .match(/^\w+\.\w+\.(\w+) /)?.at(1)
        }
        //TODO else report
        return undefined;
      }
      default: {
        //TODO report
      }
    }
  }
  catch (e) {
    //TODO report
  }
  return undefined;
}

function extractContentType(headers: any): string | undefined {
  try {
    if (headers?.has('Content-Type')) {
      return headers.get('Content-Type');
    }
  } catch (err) {
    dispatchReport('extractContentType', err);
  }
  return undefined;
}

function sizeOf(body: any): number {
  if (body) {
    try {
      return new Blob([JSON.stringify(body)]).size;
    }
    catch (e) {
      //TODO report
    }
  }
  return -1;
}
