import {
  addExportListener, addReloadListener, addShutdownListener, addTraceListener, configureReporter,
  dispatchExport, dispatchLog, dispatchReload, dispatchReport, dispatchShutown, dispatchTraces, WIN
} from './event-bus';
import { EventTrace, TRACE_TYPE_LOG, TRACE_TYPE_SESSION_EVENT } from './trace.model';

describe('event bus', () => {
  const sessionId = '00000000-0000-4000-8000-000000000001';
  let traces: EventTrace[][];
  let unsubscribe: () => void;

  beforeEach(() => {
    traces = [];
    unsubscribe = addTraceListener(event => {
      traces.push((event as CustomEvent<{ traces: EventTrace[] }>).detail.traces);
    });
    spyOn(Date, 'now').and.returnValue(2500);
  });

  afterEach(() => {
    unsubscribe();
    configureReporter(false);
  });

  it('delivers trace batches in order and lets listeners unsubscribe', () => {
    const first = { id: 'first' };
    const second = { id: 'second' };
    dispatchTraces(first, second);
    unsubscribe();
    dispatchTraces({ id: 'ignored' });

    expect(traces).toEqual([[first, second]]);
    expect(traces[0][0]).toBe(first);
  });

  it('dispatches a timestamped log with its session ID', () => {
    dispatchLog('WARN', 'retrying', sessionId);

    expect(traces).toEqual([[{
      '@type': TRACE_TYPE_SESSION_EVENT, instant: 2.5, type: 'WARN', value: 'retrying', sessionId
    }]]);
  });

  it('gates diagnostic reports and includes parsed error frames', () => {
    configureReporter(false);
    dispatchReport('hidden', 'action');
    configureReporter(true);
    const error = new Error('failed');
    error.stack = 'Error: failed\n at run (app.js:12:3)';
    dispatchReport('visible', 'action', error);

    expect(traces).toEqual([[jasmine.objectContaining({
      '@type': TRACE_TYPE_LOG, instant: 2.5, message: 'visible {}', action: 'action',
      stackTraceRows: [jasmine.objectContaining({ className: 'app.js', methodName: 'run', lineNumber: 12 })]
    })]]);
  });

  it('routes lifecycle events to the right listeners and supports reload and shutdown cleanup', () => {
    const onExport = jasmine.createSpy('export');
    const onReload = jasmine.createSpy('reload');
    const onShutdown = jasmine.createSpy('shutdown');
    addExportListener(onExport);
    const removeReload = addReloadListener(onReload);
    const removeShutdown = addShutdownListener(onShutdown);

    try {
      dispatchExport();
      expect(onExport).toHaveBeenCalledTimes(1);
      expect(onReload).not.toHaveBeenCalled();
      expect(onShutdown).not.toHaveBeenCalled();

      dispatchReload();
      expect(onReload).toHaveBeenCalledTimes(1);
      expect(onShutdown).not.toHaveBeenCalled();
      dispatchShutown();
      expect(onShutdown).toHaveBeenCalledTimes(1);

      removeReload();
      removeShutdown();
      dispatchReload();
      dispatchShutown();
      expect(onReload).toHaveBeenCalledTimes(1);
      expect(onShutdown).toHaveBeenCalledTimes(1);
      expect(onExport).toHaveBeenCalledTimes(1);
    } finally {
      removeReload();
      removeShutdown();
      (WIN['event-bus'] as EventTarget).removeEventListener('export', onExport);
    }
  });
});
