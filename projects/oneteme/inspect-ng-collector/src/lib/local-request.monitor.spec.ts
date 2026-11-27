import { addTraceListener, WIN } from './event-bus';
import { LocalRequestMonitor } from './local-request.monitor';
import {
  EventTrace, ExceptionTrace, Mask, TRACE_TYPE_EXCEPTION, TRACE_TYPE_LOCAL_REQUEST,
  TRACE_TYPE_LOCAL_REQUEST_CALLBACK, TraceType
} from './trace.model';

describe('LocalRequestMonitor', () => {
  class CartService {}

  const requestId = '00000000-0000-4000-8000-000000000001';
  const sessionId = '00000000-0000-4000-8000-000000000002';
  const sessionKey = 'inspect-session-manager';
  let previousSession: PropertyDescriptor | undefined;
  let now: jasmine.Spy<typeof Date.now>;
  let traces: EventTrace[][];
  let unsubscribe: () => void;

  beforeEach(() => {
    previousSession = Object.getOwnPropertyDescriptor(WIN, sessionKey);
    WIN[sessionKey] = undefined;
    now = spyOn(Date, 'now').and.returnValue(1500);
    spyOn(crypto, 'randomUUID').and.returnValue(requestId);
    traces = [];
    unsubscribe = addTraceListener(event => {
      traces.push((event as CustomEvent<{ traces: EventTrace[] }>).detail.traces);
    });
  });

  afterEach(() => {
    unsubscribe();
    if (previousSession) Object.defineProperty(WIN, sessionKey, previousSession);
    else Reflect.deleteProperty(WIN, sessionKey);
  });

  it('emits method and session metadata, then a successful callback with the same ID', () => {
    const traceSessionMaskUpdate = jasmine.createSpy('traceSessionMaskUpdate').and.returnValue({ sessionId });
    WIN[sessionKey] = { traceSessionMaskUpdate, currentSession: { user: 'tester' } };
    const monitor = new LocalRequestMonitor();

    monitor.preProcess('checkout', CartService.prototype);
    now.and.returnValue(3000);
    monitor.postProcess();

    expect(traceSessionMaskUpdate).toHaveBeenCalledOnceWith(Mask.LOCAL);
    expect(traces).toEqual([[{
      '@type': TRACE_TYPE_LOCAL_REQUEST, id: requestId, sessionId, name: 'checkout',
      location: 'CartService', user: 'tester', start: 1.5
    }], [{
      '@type': TRACE_TYPE_LOCAL_REQUEST_CALLBACK, id: requestId, end: 3, status: 200
    }]]);
  });

  it('records the request without session metadata when no manager is installed', () => {
    new LocalRequestMonitor().preProcess('checkout', CartService.prototype);

    expect(traces).toEqual([[{
      '@type': TRACE_TYPE_LOCAL_REQUEST, id: requestId, name: 'checkout',
      location: 'CartService', user: undefined, start: 1.5
    }]]);
  });

  it('batches a failed callback with its correlated exception', () => {
    const exception: ExceptionTrace = {
      '@type': TRACE_TYPE_EXCEPTION, message: 'failed', traceType: TraceType.LCL_RQT, offset: 1.5
    };
    new LocalRequestMonitor().postProcess(exception);

    expect(traces).toEqual([[{
      '@type': TRACE_TYPE_LOCAL_REQUEST_CALLBACK, id: requestId, end: 1.5, status: 400
    }, jasmine.objectContaining({ '@type': TRACE_TYPE_EXCEPTION, message: 'failed', traceId: requestId })]]);
  });
});
