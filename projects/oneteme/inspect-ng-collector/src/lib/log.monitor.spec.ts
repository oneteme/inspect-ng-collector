import { addTraceListener } from './event-bus';
import { installConsoleCapture } from './log.monitor';
import { SessionManager } from './session-manager.service';
import { EventTrace, Mask, TRACE_TYPE_SESSION_EVENT, UUID } from './trace.model';

describe('log monitor', () => {
  const sessionId: UUID = '00000000-0000-4000-8000-000000000001';
  let warn: jasmine.Spy;
  let error: jasmine.Spy;
  let target: Pick<Console, 'warn' | 'error'>;
  let session: jasmine.SpyObj<SessionManager>;
  let traces: EventTrace[];
  let removeTraceListener: () => void;

  beforeEach(() => {
    warn = jasmine.createSpy('warn');
    error = jasmine.createSpy('error');
    target = { warn, error };
    session = jasmine.createSpyObj<SessionManager>('SessionManager', ['traceSessionMaskUpdate']);
    session.traceSessionMaskUpdate.and.returnValue({ sessionId });
    spyOnProperty(SessionManager, 'instance').and.returnValue(session);
    spyOn(Date, 'now').and.returnValue(2500);
    traces = [];
    removeTraceListener = addTraceListener(event => {
      traces.push(...(event as CustomEvent<{ traces: EventTrace[] }>).detail.traces);
    });
    installConsoleCapture(target);
  });

  afterEach(() => removeTraceListener());

  for (const [method, level] of [['warn', 'WARN'], ['error', 'ERROR']] as const) {
    it(`forwards console.${method} arguments and emits a ${level} session event`, () => {
      const original = method === 'warn' ? warn : error;
      const details = { count: 2 };

      target[method]('sample', details);

      expect(original).toHaveBeenCalledOnceWith('sample', details);
      expect(original.calls.mostRecent().object).toBe(target);
      expect(session.traceSessionMaskUpdate).toHaveBeenCalledOnceWith(Mask.EVENT);
      expect(traces).toEqual([{
        '@type': TRACE_TYPE_SESSION_EVENT, type: level, instant: 2.5, value: 'sample {"count":2}', sessionId
      }]);
    });
  }

  it('formats errors with or without a stack', () => {
    const withStack = new TypeError('invalid');
    withStack.stack = 'at run (app.js:1:2)';
    const withoutStack = new Error('missing');
    withoutStack.stack = undefined;

    target.error(withStack, withoutStack);

    expect(traces).toEqual([jasmine.objectContaining({
      value: 'TypeError: invalid\nat run (app.js:1:2) Error: missing'
    })]);
  });

  it('falls back to string conversion for undefined and circular values', () => {
    const circular: { self?: object } = {};
    circular.self = circular;

    target.warn(undefined, circular);

    expect(traces).toEqual([jasmine.objectContaining({ value: 'undefined [object Object]' })]);
  });

  it('does not wrap the same console twice', () => {
    const installedWarn = target.warn;
    const installedError = target.error;

    installConsoleCapture(target);
    target.warn('once');

    expect(target.warn).toBe(installedWarn);
    expect(target.error).toBe(installedError);
    expect(warn).toHaveBeenCalledOnceWith('once');
    expect(traces).toHaveSize(1);
  });

  it('reports capture failures through the original error method without recapturing them', () => {
    const failure = new Error('session unavailable');
    session.traceSessionMaskUpdate.and.throwError(failure);

    target.error('original message');

    expect(error.calls.allArgs()).toEqual([['original message'], ['Failed to capture console message', failure]]);
    expect(session.traceSessionMaskUpdate).toHaveBeenCalledOnceWith(Mask.EVENT);
    expect(traces).toEqual([]);
  });
});
