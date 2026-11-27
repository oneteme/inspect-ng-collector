import { HttpErrorResponse, HttpHeaderResponse, HttpHeaders, HttpParams, HttpRequest, HttpResponse } from '@angular/common/http';
import { validateAndGetConfig } from './configuration';
import { addTraceListener, configureReporter } from './event-bus';
import { RestRequestMonitor, TRACE_HEADER } from './rest-request.monitor';
import { SessionManager } from './session-manager.service';
import {
  EventTrace, Mask, TRACE_TYPE_EXCEPTION, TRACE_TYPE_HTTP_REQUEST_STAGE, TRACE_TYPE_LOG,
  TRACE_TYPE_MAIN_SESSION_CALLBACK, TRACE_TYPE_REST_REQUEST, TRACE_TYPE_REST_REQUEST_CALLBACK, TraceType
} from './trace.model';

describe('RestRequestMonitor', () => {
  const requestId = '00000000-0000-4000-8000-000000000001';
  const sessionId = '00000000-0000-4000-8000-000000000002';
  let session: SessionManager;
  let traces: EventTrace[];
  let now: jasmine.Spy<typeof Date.now>;
  let removeTraceListener: () => void;

  function getRequest(authorization?: string): HttpRequest<unknown> {
    const headers = authorization === undefined ? new HttpHeaders() : new HttpHeaders({ Authorization: authorization });
    return new HttpRequest('GET', '/items', { headers });
  }

  function withReporter(run: () => void): void {
    configureReporter(true);
    try {
      run();
    } finally {
      configureReporter(false);
    }
  }

  beforeEach(() => {
    session = new SessionManager(validateAndGetConfig({
      application: { name: 'shop', namespace: 'team', env: 'test' },
      collector: { tracing: { remote: { host: 'https://collector.example' } } }
    }, sessionId));
    session.currentSessionCallBack = { '@type': TRACE_TYPE_MAIN_SESSION_CALLBACK, id: sessionId, eventMask: 0 };
    spyOnProperty(SessionManager, 'instance').and.returnValue(session);
    spyOn(crypto, 'randomUUID').and.returnValue(requestId);
    now = spyOn(Date, 'now').and.returnValue(1500);
    traces = [];
    removeTraceListener = addTraceListener(event => {
      traces.push(...(event as CustomEvent<{ traces: EventTrace[] }>).detail.traces);
    });
  });

  afterEach(() => removeTraceListener());

  it('records the generated request ID and start time in seconds', () => {
    const monitor = new RestRequestMonitor();

    expect(monitor.id).toBe(requestId);
    expect(monitor.start).toBe(1.5);
  });

  it('emits URL metadata, response type, UTF-8 body size and session ID', () => {
    const body = { label: '\u00e9' };
    const request = new HttpRequest('POST', 'https://api.example:8443/items?sort=name', body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      params: new HttpParams().set('page', '2'),
      responseType: 'text'
    });

    new RestRequestMonitor().preProcess(request);

    expect(traces).toEqual([jasmine.objectContaining({
      '@type': TRACE_TYPE_REST_REQUEST, id: requestId, sessionId, method: 'POST',
      protocol: 'https', host: 'api.example', port: 8443, path: '/items', query: 'sort=name&page=2',
      contentType: 'text', dataSize: new TextEncoder().encode(JSON.stringify(body)).length, start: 1.5
    })]);
    expect(session.currentSessionCallBack?.eventMask).toBe(Mask.REST);
  });

  it('resolves a relative URL and uses defaults for a missing body and credentials', () => {
    new RestRequestMonitor().preProcess(getRequest());

    expect(traces).toEqual([jasmine.objectContaining({
      '@type': TRACE_TYPE_REST_REQUEST, method: 'GET', host: location.hostname,
      port: Number(location.port), path: '/items', query: '', dataSize: -1, authScheme: null, user: null
    })]);
  });

  it('still emits the request trace without an active session', () => {
    session.currentSessionCallBack = undefined;

    new RestRequestMonitor().preProcess(getRequest());

    expect(traces).toEqual([jasmine.objectContaining({ '@type': TRACE_TYPE_REST_REQUEST, id: requestId })]);
    expect(traces[0]).not.toEqual(jasmine.objectContaining({ sessionId: jasmine.anything() }));
  });

  for (const [scheme, credentials] of [
    ['Basic', btoa('tester:sample-password')],
    ['Bearer', `header.${btoa(JSON.stringify({ sub: 'tester' }))}.signature`]
  ]) {
    it(`extracts the user from ${scheme} credentials`, () => {
      new RestRequestMonitor().preProcess(getRequest(`${scheme} ${credentials}`));

      expect(traces).toEqual([jasmine.objectContaining({ '@type': TRACE_TYPE_REST_REQUEST, authScheme: scheme, user: 'tester' })]);
    });
  }

  for (const authorization of ['Digest sample', 'Basic']) {
    it(`ignores authorization header "${authorization}"`, () => {
      new RestRequestMonitor().preProcess(getRequest(authorization));

      expect(traces).toEqual([jasmine.objectContaining({ '@type': TRACE_TYPE_REST_REQUEST, authScheme: null, user: null })]);
    });
  }

  for (const { scheme, credentials, message } of [
    { scheme: 'Bearer', credentials: 'malformed', message: /^Invalid .* format/ },
    { scheme: 'Basic', credentials: '*', message: /^Unable to extract the user identifier/ },
    { scheme: 'Bearer', credentials: `header.${btoa('not json')}.signature`, message: /^Unable to extract the user identifier/ }
  ]) {
    it(`reports invalid ${scheme} credentials (${credentials}) without dropping the request`, () => {
      withReporter(() => new RestRequestMonitor().preProcess(getRequest(`${scheme} ${credentials}`)));

      expect(traces).toEqual([
        jasmine.objectContaining({
          '@type': TRACE_TYPE_LOG, action: 'rest-request.monitor.extractUser', message: jasmine.stringMatching(message)
        }),
        jasmine.objectContaining({ '@type': TRACE_TYPE_REST_REQUEST, authScheme: scheme, user: null })
      ]);
    });
  }

  it('reports an unserializable request body and records an unknown body size', () => {
    const body: { self?: object } = {};
    body.self = body;

    withReporter(() => new RestRequestMonitor().preProcess(new HttpRequest('POST', '/items', body)));

    expect(traces).toEqual([
      jasmine.objectContaining({ '@type': TRACE_TYPE_LOG, action: 'rest-request.monitor.sizeOf' }),
      jasmine.objectContaining({ '@type': TRACE_TYPE_REST_REQUEST, dataSize: -1 })
    ]);
  });

  it('emits ordered, correlated request, callback and processing traces for a successful response', () => {
    const monitor = new RestRequestMonitor();
    monitor.preProcess(getRequest());
    now.and.returnValue(2750);
    monitor.postProcess(new HttpResponse({
      status: 201, body: { ok: true },
      headers: new HttpHeaders({ 'Content-Type': 'application/json', [TRACE_HEADER]: requestId })
    }), null);

    expect(traces).toEqual([
      jasmine.objectContaining({ '@type': TRACE_TYPE_REST_REQUEST, id: requestId }),
      jasmine.objectContaining({
        '@type': TRACE_TYPE_REST_REQUEST_CALLBACK, id: requestId, status: 201, dataSize: 11,
        contentType: 'application/json', linked: true, end: 2.75
      }),
      jasmine.objectContaining({
        '@type': TRACE_TYPE_HTTP_REQUEST_STAGE, requestId, name: 'PROCESS', start: 1.5, end: 2.75, order: 0
      })
    ]);
  });

  for (const traceHeader of [undefined, sessionId]) {
    it(`leaves the response unlinked when the trace header is ${traceHeader ? 'different' : 'missing'}`, () => {
      const headers = traceHeader ? new HttpHeaders({ [TRACE_HEADER]: traceHeader }) : new HttpHeaders();
      new RestRequestMonitor().postProcess(new HttpHeaderResponse({ status: 204, headers }), null);

      expect(traces[0]).toEqual(jasmine.objectContaining({
        '@type': TRACE_TYPE_REST_REQUEST_CALLBACK, status: 204, linked: false, dataSize: -1, contentType: undefined
      }));
    });
  }

  it('reports a header lookup failure and still emits the completion trace', () => {
    const headers = new HttpHeaders();
    spyOn(headers, 'has').and.throwError('header lookup failed');

    withReporter(() => new RestRequestMonitor().postProcess(new HttpResponse({ headers }), null));

    expect(traces).toEqual([
      jasmine.objectContaining({ '@type': TRACE_TYPE_LOG, action: 'rest-request.monitor.extractContentType' }),
      jasmine.objectContaining({ '@type': TRACE_TYPE_REST_REQUEST_CALLBACK, status: 200, contentType: undefined }),
      jasmine.objectContaining({ '@type': TRACE_TYPE_HTTP_REQUEST_STAGE, requestId })
    ]);
  });

  it('emits a correlated exception and records the error body, content type and link', () => {
    const body = { reason: 'failed' };
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', [TRACE_HEADER]: requestId });

    new RestRequestMonitor().postProcess(null, new HttpErrorResponse({ status: 500, error: body, headers }));

    expect(traces).toEqual([
      jasmine.objectContaining({ '@type': TRACE_TYPE_EXCEPTION, traceId: requestId, traceType: TraceType.HTTP_REQ }),
      jasmine.objectContaining({
        '@type': TRACE_TYPE_REST_REQUEST_CALLBACK, id: requestId, status: 500, bodyContent: JSON.stringify(body),
        dataSize: 19, contentType: 'application/json', linked: true
      }),
      jasmine.objectContaining({ '@type': TRACE_TYPE_HTTP_REQUEST_STAGE, requestId, exception: traces[0] })
    ]);
  });

  for (const { name, status } of [{ name: 'HttpErrorResponse', status: 0 }, { name: 'TimeoutError', status: 4 }]) {
    it(`records a bodyless ${name} with status ${status}`, () => {
      const error = new HttpErrorResponse({ status: 0 });
      if (name === 'TimeoutError') {
        Object.defineProperty(error, 'name', { value: name });
      }

      new RestRequestMonitor().postProcess(null, error);

      expect(traces[1]).toEqual(jasmine.objectContaining({
        '@type': TRACE_TYPE_REST_REQUEST_CALLBACK, status, dataSize: -1, linked: false
      }));
      expect(traces[1]).not.toEqual(jasmine.objectContaining({ bodyContent: jasmine.anything() }));
    });
  }
});
