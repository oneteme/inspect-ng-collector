import { addTraceListener, configureReporter } from './event-bus';
import { GlobalErrorHandler } from './global-error-handler.service';
import { SessionManager } from './session-manager.service';
import { EventTrace, TRACE_TYPE_EXCEPTION, TRACE_TYPE_LOG, TraceType } from './trace.model';

describe('GlobalErrorHandler', () => {
  const sessionId = '00000000-0000-4000-8000-000000000001';
  let session: jasmine.SpyObj<SessionManager>;
  let traces: EventTrace[];
  let unsubscribe: () => void;

  beforeEach(() => {
    session = jasmine.createSpyObj<SessionManager>('SessionManager', ['markSessionFailed']);
    session.markSessionFailed.and.returnValue(sessionId);
    spyOnProperty(SessionManager, 'instance').and.returnValue(session);
    traces = [];
    unsubscribe = addTraceListener(event => traces.push(...(event as CustomEvent<{ traces: EventTrace[] }>).detail.traces));
  });

  afterEach(() => {
    unsubscribe();
    configureReporter(false);
  });

  it('marks the active session as failed and emits a correlated exception with stack frames', () => {
    const error = new TypeError('unexpected');
    error.stack = 'TypeError: unexpected\n at render (app.js:12:3)';
    new GlobalErrorHandler().handleError(error);

    expect(session.markSessionFailed).toHaveBeenCalledTimes(1);
    expect(traces).toEqual([jasmine.objectContaining({
      '@type': TRACE_TYPE_EXCEPTION, type: 'TypeError', message: 'unexpected', traceId: sessionId,
      traceType: TraceType.MAIN_SES,
      stackTraceRows: [jasmine.objectContaining({ className: 'app.js', methodName: 'render', lineNumber: 12 })]
    })]);
  });

  it('emits string errors even when no session ID is available', () => {
    session.markSessionFailed.and.returnValue(undefined);
    new GlobalErrorHandler().handleError('unexpected');

    expect(traces).toEqual([jasmine.objectContaining({
      '@type': TRACE_TYPE_EXCEPTION, message: 'unexpected', traceId: undefined, traceType: TraceType.MAIN_SES
    })]);
  });

  it('reports an internal handler failure without emitting an exception trace', () => {
    configureReporter(true);
    session.markSessionFailed.and.throwError('session unavailable');
    new GlobalErrorHandler().handleError(new Error('original'));

    expect(traces).toEqual([jasmine.objectContaining({
      '@type': TRACE_TYPE_LOG, action: 'global-error-handler.GlobalErrorHandlerService.handleError',
      message: jasmine.stringMatching(/^Unable to process an uncaught application error/)
    })]);
  });
});
