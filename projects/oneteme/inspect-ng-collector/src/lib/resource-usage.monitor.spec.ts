import { addTraceListener, configureReporter, dispatchExport, WIN } from './event-bus';
import { initResourceUsageMonitor } from './resource-usage.monitor';
import { EventTrace, TRACE_TYPE_LOG, TRACE_TYPE_RESOURCE_USAGE } from './trace.model';

describe('resource usage monitor', () => {
  let bus: EventTarget;
  let register: jasmine.Spy<EventTarget['addEventListener']>;
  let traces: EventTrace[];
  let unsubscribe: () => void;

  function mockMemory(read?: () => object): void {
    const performanceStub = new Proxy(performance, {
      has: (target, key) => key === 'memory' ? read !== undefined : Reflect.has(target, key),
      get: (target, key) => key === 'memory' ? read?.() : Reflect.get(target, key)
    });
    spyOnProperty(window, 'performance').and.returnValue(performanceStub);
  }

  beforeEach(() => {
    traces = [];
    unsubscribe = addTraceListener(event => traces.push(...(event as CustomEvent<{ traces: EventTrace[] }>).detail.traces));
    bus = WIN['event-bus'];
    register = spyOn(bus, 'addEventListener').and.callThrough();
    spyOn(Date, 'now').and.returnValue(2500);
  });

  afterEach(() => {
    register.calls.allArgs().forEach(([type, listener, options]) => {
      if (type === 'export') bus.removeEventListener(type, listener, options);
    });
    unsubscribe();
    configureReporter(false);
  });

  it('reports heap usage in MiB on export when browser memory metrics are available', () => {
    mockMemory(() => ({ usedJSHeapSize: 1.5 * 1024 * 1024, totalJSHeapSize: 4 * 1024 * 1024 }));
    initResourceUsageMonitor();
    expect(traces).toEqual([]);

    dispatchExport();

    expect(traces).toEqual([{
      '@type': TRACE_TYPE_RESOURCE_USAGE, instant: 2.5, usedHeap: 1.5,
      commitedHeap: 4, availableProcessors: navigator.hardwareConcurrency
    }]);
  });

  it('does not register an export listener without browser memory metrics', () => {
    mockMemory();
    initResourceUsageMonitor();

    expect(register).not.toHaveBeenCalled();
    expect(traces).toEqual([]);
  });

  it('reports errors reading heap metrics without emitting a usage trace', () => {
    mockMemory(() => { throw new Error('heap unavailable'); });
    configureReporter(true);
    initResourceUsageMonitor();

    dispatchExport();

    expect(traces).toEqual([jasmine.objectContaining({
      '@type': TRACE_TYPE_LOG, action: 'resource-usage.monitor.resourceUsageHandler'
    })]);
  });

  it('reports listener registration failures', () => {
    mockMemory(() => ({}));
    configureReporter(true);
    register.and.throwError('registration failed');

    initResourceUsageMonitor();

    expect(traces).toEqual([jasmine.objectContaining({
      '@type': TRACE_TYPE_LOG, action: 'resource-usage.monitor.initResourceUsageMonitor'
    })]);
  });
});
