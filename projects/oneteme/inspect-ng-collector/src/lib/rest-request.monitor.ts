import {
  dateNow,
  ExceptionInfo,
  HttpRequestStage,
  RestRequest,
  RestRequestCallBack,
  RequestMask,
  TRACE_TYPE_HTTP_REQUEST_STAGE,
  TRACE_TYPE_REST_REQUEST,
  TRACE_TYPE_REST_REQUEST_CALLBACK,
  UUID
} from "./trace.model";
import { dispatchTraces, dispatchReport } from "./event-bus";
import { HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse, HttpResponseBase } from "@angular/common/http";
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
    const url = new URL(restRequest.urlWithParams, globalThis.location.origin);
    const auth_user = extractAuthSchemeAnduser(restRequest.headers);
    dispatchTraces({...SessionManager.instance.initRestRequest(RequestMask.REST),
      "@type": TRACE_TYPE_REST_REQUEST,
      id: this.id,
      method: restRequest.method,
      protocol: url.protocol.slice(0, -1),
      host: url.hostname,
      port: url.port? Number(url.port) : 0,
      path: url.pathname,
      query: url.search.slice(1, url.search.length),
      contentType: restRequest.responseType,
      authScheme: auth_user.authScheme,
      user: auth_user.user,
      dataSize: sizeOf(restRequest.body),
      start: this.start,
    } as RestRequest);
  }

  postProcess(response: HttpResponseBase | null, error: HttpErrorResponse | null) {
    const end = dateNow();
    const callback: RestRequestCallBack = {
      "@type": TRACE_TYPE_REST_REQUEST_CALLBACK,
      id: this.id,
      dataSize: -1,
      linked: false,
      end: end
    }
    let status: number = 0, exception!: ExceptionInfo;

    // HttpResponseBase couvre à la fois HttpResponse (succès) et HttpErrorResponse (erreur HTTP)
    if (response) {
      status = response.status;
      callback.dataSize = response instanceof HttpResponse ? sizeOf(response.body) : -1;
      callback.contentType = extractContentType(response.headers);
      callback.linked = assertSessionID(this.id, response.headers);
    }

    // Erreur réseau/annulation
    if (error) {
      status = error.status || 0;
      exception = {
        type: error.name,
        message: error.error && error.status ? JSON.stringify(error.error) : error.message
      }
      callback.bodyContent = JSON.stringify(error.error);
      callback.dataSize = sizeOf(error.error);
      callback.contentType = extractContentType(error.headers);
      callback.linked = assertSessionID(this.id, error.headers);
    }

    callback.status = status;
    dispatchTraces(callback, {
      "@type": TRACE_TYPE_HTTP_REQUEST_STAGE,
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

function extractAuthSchemeAnduser(headers: any): { user: string | null, authScheme: string | null } {
  const authHeader = headers?.get('authorization');
  if (!authHeader) {
    return { authScheme: null, user: null };
  }

  const [scheme, credentials] = authHeader.split(' ');

  if (!scheme || !credentials || !['Basic', 'Bearer'].includes(scheme)) {
    return { authScheme: null, user: null };
  }

  return {
    authScheme: scheme,
    user: extractUser(scheme as 'Basic' | 'Bearer', credentials) ?? null
  };
}

function extractUser(scheme: 'Basic' | 'Bearer', authorization: string) {
  try {
    switch (scheme) {
      case "Basic":
        return atob(authorization).split(':')[0] || undefined;
      case "Bearer": {
        const payloadMatch = authorization.match(/^[^.]+\.([^.]+)\.[^.]+$/);
        if (payloadMatch?.[1]) {
          return JSON.parse(atob(payloadMatch[1])).sub;
        }
        dispatchReport('extractUser', 'Invalid Bearer token format');
        return undefined;
      }
      default:
        dispatchReport('extractUser', `Unknown auth scheme: ${scheme}`);
    }
  } catch (e) {
    dispatchReport('extractUser', e);
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
      dispatchReport('sizeOf', e);
    }
  }
  return -1;
}
