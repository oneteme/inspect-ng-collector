import {
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpHandler,
  HttpHeaders,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { EMPTY, NEVER, Observable, of, throwError } from 'rxjs';
import { addTraceListener } from './event-bus';
import { HttpInterceptorService } from './http-interceptor.service';
import { SessionManager } from './session-manager.service';
import { TechnicalConf } from './configuration';
import {
  InstanceEnvironment,
  TRACE_TYPE_EXCEPTION,
  TRACE_TYPE_HTTP_REQUEST_STAGE,
  TRACE_TYPE_REST_REQUEST,
  TRACE_TYPE_REST_REQUEST_CALLBACK
} from './trace.model';
import { TRACE_HEADER } from './rest-request.monitor';

describe('HttpInterceptorService', () => {
  interface CapturedTrace {
    '@type'?: string;
    status?: number;
    requestId?: string;
    name?: string;
  }

  const sessionId = '00000000-0000-4000-8000-000000000001';
  const instance: InstanceEnvironment = {
    id: '00000000-0000-4000-8000-000000000002',
    resource: {},
    namespace: 'team'
  };
  let capturedTraces: CapturedTrace[];
  let removeTraceListener: () => void;

  function createService(hostExcludes?: string[]): HttpInterceptorService {
    const tech: TechnicalConf = {
      queueCapacity: 1,
      interval: 1,
      instanceApi: 'https://collector.example/instance',
      sessionApi: 'https://collector.example/session',
      hostExcludes,
      debugMode: false,
      analytics: false,
      resources: false,
      storage: false,
      logger: false,
      reporter: false,
      namespaceHeader: '',
      enabled: true
    };
    return new HttpInterceptorService({ tech, instance });
  }

  function request(url = '/api/items'): HttpRequest<unknown> {
    return new HttpRequest('GET', url, {
      headers: new HttpHeaders({ 'X-Test': 'present' })
    });
  }

  function trace(type: string): CapturedTrace | undefined {
    return capturedTraces.find(item => item['@type'] === type);
  }

  beforeEach(() => {
    capturedTraces = [];
    SessionManager.initialize({
      queueCapacity: 1,
      interval: 1,
      instanceApi: 'https://collector.example/instance',
      sessionApi: 'https://collector.example/session',
      debugMode: false,
      analytics: false,
      resources: false,
      storage: false,
      logger: false,
      reporter: false,
      namespaceHeader: '',
      enabled: true
    });
    spyOn(SessionManager.instance, 'traceSessionMaskUpdate').and.returnValue({ sessionId });
    removeTraceListener = addTraceListener(event => {
      const detail = (event as CustomEvent<{ traces: CapturedTrace[] }>).detail;
      capturedTraces.push(...detail.traces);
    });
  });

  afterEach(() => {
    removeTraceListener();
  });

  it('adds a trace header while preserving existing headers', () => {
    const original = request();
    const handle = jasmine.createSpy('handle').and.returnValue(
      of(new HttpResponse({ status: 200, body: { ok: true } }))
    );

    createService().intercept(original, { handle }).subscribe();

    const forwarded = handle.calls.mostRecent().args[0] as HttpRequest<unknown>;
    expect(forwarded).not.toBe(original);
    expect(forwarded.headers.get('X-Test')).toBe('present');
    expect(forwarded.headers.get(TRACE_HEADER)).toEqual(jasmine.any(String));
    expect(forwarded.headers.get(TRACE_HEADER)).not.toBe('');
  });

  it('does not add a trace header for an excluded host', () => {
    const handle = jasmine.createSpy('handle').and.returnValue(
      of(new HttpResponse({ status: 200 }))
    );

    createService(['api.example']).intercept(request('https://api.example/items'), { handle }).subscribe();

    const forwarded = handle.calls.mostRecent().args[0] as HttpRequest<unknown>;
    expect(forwarded.headers.has(TRACE_HEADER)).toBeFalse();
  });

  it('forwards a successful response and emits request and completion traces', () => {
    const response = new HttpResponse({
      status: 200,
      body: { result: 'ok' },
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    });
    const handle = jasmine.createSpy('handle').and.returnValue(of(response));
    let received: HttpEvent<unknown> | undefined;

    createService().intercept(request(), { handle }).subscribe(event => received = event);

    expect(received).toBe(response);
    expect(trace(TRACE_TYPE_REST_REQUEST)).toBeDefined();
    expect(trace(TRACE_TYPE_REST_REQUEST_CALLBACK)?.status).toBe(200);
    expect(trace(TRACE_TYPE_HTTP_REQUEST_STAGE)?.name).toBe('PROCESS');
  });

  it('ignores progress events when building the completion trace', () => {
    const progress: HttpEvent<unknown> = {
      type: HttpEventType.DownloadProgress,
      loaded: 10,
      total: 20
    };
    const response = new HttpResponse({ status: 204 });
    const handle = jasmine.createSpy('handle').and.returnValue(of(progress, response));

    createService().intercept(request(), { handle }).subscribe();

    expect(trace(TRACE_TYPE_REST_REQUEST_CALLBACK)?.status).toBe(204);
    expect(capturedTraces.filter(item => item['@type'] === TRACE_TYPE_REST_REQUEST_CALLBACK)).toHaveSize(1);
  });

  it('rethrows HTTP errors and emits an error completion trace', () => {
    const error = new HttpErrorResponse({
      status: 500,
      statusText: 'Server Error',
      error: { message: 'failure' },
      url: '/api/items'
    });
    const handle = jasmine.createSpy('handle').and.returnValue(
      throwError(() => error)
    );
    let receivedError: unknown;

    createService().intercept(request(), { handle }).subscribe({
      error: received => receivedError = received
    });

    expect(receivedError).toBe(error);
    expect(trace(TRACE_TYPE_EXCEPTION)).toBeDefined();
    expect(trace(TRACE_TYPE_REST_REQUEST_CALLBACK)?.status).toBe(500);
  });

  it('records an empty response as a cancelled request', () => {
    const handle = jasmine.createSpy('handle').and.returnValue(EMPTY);

    createService().intercept(request(), { handle }).subscribe();

    expect(trace(TRACE_TYPE_REST_REQUEST_CALLBACK)?.status).toBe(10);
  });

  it('records an unsubscribed request as cancelled', () => {
    const handle = jasmine.createSpy('handle').and.returnValue(NEVER);
    const subscription = createService().intercept(request(), { handle }).subscribe();

    subscription.unsubscribe();

    expect(trace(TRACE_TYPE_REST_REQUEST_CALLBACK)?.status).toBe(10);
  });

  it('handles a missing host exclusion list', () => {
    const handle = jasmine.createSpy('handle').and.returnValue(
      of(new HttpResponse({ status: 200 }))
    );

    createService().intercept(request(), { handle }).subscribe();

    const forwarded = handle.calls.mostRecent().args[0] as HttpRequest<unknown>;
    expect(forwarded.headers.has(TRACE_HEADER)).toBeTrue();
  });
});
