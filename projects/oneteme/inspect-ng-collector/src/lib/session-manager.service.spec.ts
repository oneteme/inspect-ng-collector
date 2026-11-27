import { validateAndGetConfig } from './configuration';
import { addTraceListener, configureReporter, WIN } from './event-bus';
import { SessionManager, sessionlogger, sessionManager } from './session-manager.service';
import {
  EventTrace, Mask, TRACE_TYPE_LOG, TRACE_TYPE_MAIN_SESSION, TRACE_TYPE_MAIN_SESSION_CALLBACK,
  TRACE_TYPE_SESSION_EVENT, TRACE_TYPE_SESSION_MASK_UPDATE, UUID
} from './trace.model';

describe('SessionManager', () => {
  const firstId: UUID = '00000000-0000-4000-8000-000000000001';
  const secondId: UUID = '00000000-0000-4000-8000-000000000002';
  const firstUrl = 'https://app.example/items';
  const secondUrl = 'https://app.example/cart';
  const tech = validateAndGetConfig({
    application: { name: 'shop', namespace: 'team', env: 'test' },
    collector: { tracing: { remote: { host: 'https://collector.example' } } }
  }, firstId);
  let manager: SessionManager;
  let traces: EventTrace[];
  let now: jasmine.Spy<typeof Date.now>;
  let removeTraceListener: () => void;

  beforeEach(() => {
    manager = new SessionManager(tech);
    traces = [];
    now = spyOn(Date, 'now').and.returnValue(1500);
    spyOn(crypto, 'randomUUID').and.returnValues(firstId, secondId);
    removeTraceListener = addTraceListener(event => {
      traces.push(...(event as CustomEvent<{ traces: EventTrace[] }>).detail.traces);
    });
  });

  afterEach(() => removeTraceListener());

  it('creates a view and callback with the same ID and resolves the user provider', () => {
    const user = jasmine.createSpy('user').and.returnValue('tester');
    manager = new SessionManager({ ...tech, user });

    expect(manager.navigate(firstUrl)).toEqual({
      '@type': TRACE_TYPE_MAIN_SESSION, id: firstId, type: 'VIEW', user: 'tester',
      start: 1.5, location: firstUrl, eventMask: 0, status: 200
    });
    expect(manager.getCurrentSessionCallBack(callback => callback)).toEqual({
      '@type': TRACE_TYPE_MAIN_SESSION_CALLBACK, id: firstId, eventMask: 0, status: 200
    });
    expect(manager.currentSessionID()).toBe(firstId);
    expect(user).toHaveBeenCalledTimes(1);
    expect(traces).toEqual([]);
  });

  it('emits the startup trace only once and keeps its callback active', () => {
    manager.navigate(firstUrl);
    manager.validateSession(false);
    manager.validateSession(false);

    expect(traces).toEqual([jasmine.objectContaining({
      '@type': TRACE_TYPE_MAIN_SESSION, id: firstId, name: '<startup>', location: firstUrl
    })]);
    expect(manager.hasValidateSessionBeenCalled()).toBeTrue();
    expect(manager.currentSession).toBeUndefined();
    expect(manager.currentSessionID()).toBe(firstId);
  });

  it('validates a routed view asynchronously using the document title and URL', () => {
    jasmine.clock().install();
    try {
      manager.navigate(firstUrl);
      manager.validateSession(true, 0);

      expect(traces).toEqual([]);
      expect(manager.hasValidateSessionBeenCalled()).toBeFalse();
      jasmine.clock().tick(0);

      expect(traces).toEqual([jasmine.objectContaining({
        '@type': TRACE_TYPE_MAIN_SESSION, id: firstId, name: document.title, location: document.URL
      })]);
      expect(manager.hasValidateSessionBeenCalled()).toBeTrue();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('does not re-emit the previous view after a deferred validation and rapid navigation', () => {
    jasmine.clock().install();
    try {
      manager.navigate(firstUrl);
      manager.validateSession(true, 0);
      now.and.returnValue(2750);

      const next = manager.navigate(secondUrl);
      jasmine.clock().tick(0);

      expect(traces).toEqual([
        jasmine.objectContaining({ '@type': TRACE_TYPE_MAIN_SESSION, id: firstId }),
        jasmine.objectContaining({ '@type': TRACE_TYPE_MAIN_SESSION_CALLBACK, id: firstId, end: 2.75 })
      ]);
      expect(manager.currentSession).toBe(next);
      expect(manager.currentSessionID()).toBe(secondId);
      expect(manager.hasValidateSessionBeenCalled()).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('suppresses an excluded view', () => {
    manager = new SessionManager({ ...tech, exclude: [/\/items$/] });
    manager.navigate(firstUrl);
    manager.validateSession(false);

    expect(traces).toEqual([]);
    expect(manager.hasValidateSessionBeenCalled()).toBeFalse();
  });

  it('closes the active callback with its failure status without creating another view', () => {
    manager.navigate(firstUrl);
    manager.validateSession(false);
    expect(manager.markSessionFailed()).toBe(firstId);
    now.and.returnValue(3000);

    expect(manager.navigate()).toBeUndefined();

    expect(traces[1]).toEqual({
      '@type': TRACE_TYPE_MAIN_SESSION_CALLBACK, id: firstId, eventMask: 0, status: 400, end: 3
    });
    expect(traces).toHaveSize(2);
    expect(manager.currentSessionID()).toBeUndefined();
    expect(manager.hasValidateSessionBeenCalled()).toBeFalse();
  });

  it('accumulates event masks and emits only newly added bits after validation', () => {
    manager.navigate(firstUrl);
    expect(manager.traceSessionMaskUpdate(Mask.REST)).toEqual({ sessionId: firstId });
    expect(manager.currentSessionCallBack?.eventMask).toBe(Mask.REST);
    expect(traces).toEqual([]);

    manager.validateSession(false);
    manager.traceSessionMaskUpdate(Mask.REST);
    manager.traceSessionMaskUpdate(Mask.EVENT);
    manager.traceSessionMaskUpdate(Mask.EVENT);

    expect(traces.slice(1)).toEqual([{
      '@type': TRACE_TYPE_SESSION_MASK_UPDATE, id: firstId, main: true, mask: Mask.REST | Mask.EVENT
    }]);
  });

  it('emits INFO, WARN and ERROR events linked to the active session, ignoring empty messages', () => {
    manager.navigate(firstUrl);
    manager.info('started');
    manager.warn('retrying');
    manager.error('failed');
    manager.info('');

    expect(traces).toEqual([['INFO', 'started'], ['WARN', 'retrying'], ['ERROR', 'failed']].map(([type, value]) => ({
      '@type': TRACE_TYPE_SESSION_EVENT, type, value, sessionId: firstId, instant: 1.5
    })));
    expect(manager.currentSessionCallBack?.eventMask).toBe(Mask.EVENT);
  });

  it('reports missing sessions without invoking callbacks or emitting session events', () => {
    const callback = jasmine.createSpy('callback');
    configureReporter(true);
    try {
      expect(manager.getCurrentSessionCallBack(callback)).toBeUndefined();
      expect(manager.traceSessionMaskUpdate(Mask.EVENT)).toEqual({});
      manager.validateSession();
    } finally {
      configureReporter(false);
    }

    expect(callback).not.toHaveBeenCalled();
    expect(traces).toEqual([
      'getCurrentSessionCallBack', 'getCurrentSessionCallBack', 'updateSession'
    ].map(action => jasmine.objectContaining({
      '@type': TRACE_TYPE_LOG, action: `session-manager.SessionManager.${action}`
    })));
  });

  it('publishes the initialized singleton through the accessors and browser global', () => {
    const previousInstance = Object.getOwnPropertyDescriptor(SessionManager, 'currentInstance');
    const previousGlobal = Object.getOwnPropertyDescriptor(WIN, 'inspect-session-manager');
    try {
      sessionManager(tech);

      expect(SessionManager.instance).toBeInstanceOf(SessionManager);
      expect(SessionManager._instance).toBe(SessionManager.instance);
      expect(sessionlogger()).toBe(SessionManager.instance);
      expect(WIN['inspect-session-manager']).toBe(SessionManager.instance);
    } finally {
      if (previousInstance) Object.defineProperty(SessionManager, 'currentInstance', previousInstance);
      else Reflect.deleteProperty(SessionManager, 'currentInstance');
      if (previousGlobal) Object.defineProperty(WIN, 'inspect-session-manager', previousGlobal);
      else Reflect.deleteProperty(WIN, 'inspect-session-manager');
    }
  });
});
