import { addTraceListener, configureReporter } from './event-bus';
import { SessionManager } from './session-manager.service';
import { TechnicalConf } from './configuration';
import { TRACE_TYPE_ADDITIONAL_VALUES, TRACE_TYPE_LOG, TRACE_TYPE_SESSION_EVENT } from './trace.model';
import { initUserActionMonitor } from './user-action.monitor';

describe('user action monitor', () => {
  interface CapturedTrace {
    '@type'?: string;
    type?: string;
    value?: string | null;
    scope?: string;
    location?: string;
    action?: string;
    message?: string;
  }

  const sessionId = '00000000-0000-4000-8000-000000000001';
  const technicalConfig: TechnicalConf = {
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
  };
  let capturedTraces: CapturedTrace[] = [];
  let initializationTraces: CapturedTrace[] = [];
  let removeTraceListener: () => void;
  let testElements: HTMLElement[] = [];

  function traces(): CapturedTrace[] {
    return capturedTraces;
  }

  function trackedElement(value = 'save'): HTMLButtonElement {
    const element = document.createElement('button');
    element.dataset['inspectTrack'] = value;
    element.dataset['inspectScope'] = 'toolbar';
    element.dataset['inspectLocation'] = 'header';
    document.body.appendChild(element);
    testElements.push(element);
    return element;
  }

  function setViewport(width: number, height: number): void {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  }

  beforeAll(() => {
    SessionManager.initialize(technicalConfig);
    spyOn(SessionManager.instance, 'traceSessionMaskUpdate').and.returnValue({ sessionId });
    configureReporter(true);
    removeTraceListener = addTraceListener(event => {
      const detail = (event as CustomEvent<{ traces: CapturedTrace[] }>).detail;
      capturedTraces.push(...detail.traces);
    });
    initUserActionMonitor();
    initializationTraces = [...capturedTraces];
  });

  beforeEach(() => {
    jasmine.clock().install();
    capturedTraces = [];
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    testElements.forEach(element => element.remove());
    testElements = [];
  });

  afterAll(() => {
    removeTraceListener();
    configureReporter(false);
  });

  it('emits initialization and browser configuration traces', () => {
    const emitted = initializationTraces;
    expect(emitted.some(trace => trace.type === 'Initialisation' && trace['@type'] === TRACE_TYPE_SESSION_EVENT)).toBeTrue();
    expect(emitted.some(trace => trace['@type'] === TRACE_TYPE_ADDITIONAL_VALUES)).toBeTrue();
  });

  it('emits a delayed click with tracking metadata', () => {
    const element = trackedElement();

    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(traces()).toHaveSize(0);

    jasmine.clock().tick(300);

    expect(traces()).toEqual([jasmine.objectContaining({
      '@type': TRACE_TYPE_SESSION_EVENT,
      type: 'Click',
      value: 'save',
      scope: 'toolbar',
      location: 'header'
    })]);
  });

  it('ignores clicks on untracked elements', () => {
    const element = document.createElement('button');
    document.body.appendChild(element);
    testElements.push(element);
    element.click();
    jasmine.clock().tick(300);

    expect(traces()).toHaveSize(0);
  });

  it('uses the closest tracked ancestor for nested elements', () => {
    const element = trackedElement();
    const child = document.createElement('span');
    element.appendChild(child);

    child.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    jasmine.clock().tick(300);

    expect(traces()[0]).toEqual(jasmine.objectContaining({ type: 'Click', value: 'save' }));
  });

  it('debounces clicks on the same element', () => {
    const element = trackedElement();

    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    jasmine.clock().tick(100);
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    jasmine.clock().tick(299);
    expect(traces()).toHaveSize(0);

    jasmine.clock().tick(1);
    expect(traces()).toHaveSize(1);
  });

  it('cancels a pending click when a double-click is received', () => {
    const element = trackedElement();

    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    jasmine.clock().tick(300);

    expect(traces()).toEqual([jasmine.objectContaining({ type: 'Dblclick', value: 'save' })]);
  });

  it('emits change immediately', () => {
    const element = trackedElement('country');

    element.dispatchEvent(new Event('change', { bubbles: true }));

    expect(traces()).toEqual([jasmine.objectContaining({ type: 'Change', value: 'country' })]);
  });

  it('debounces scroll events', () => {
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    jasmine.clock().tick(249);
    expect(traces()).toHaveSize(0);

    jasmine.clock().tick(1);
    expect(traces()).toEqual([jasmine.objectContaining({ type: 'Scroll', value: null })]);
  });

  it('emits resize with the current viewport dimensions', () => {
    const ratio = window.devicePixelRatio;
    window.dispatchEvent(new Event('resize'));
    jasmine.clock().tick(250);

    setViewport(1280, 720);
    window.dispatchEvent(new Event('resize'));
    jasmine.clock().tick(250);

    expect(traces()).toContain(jasmine.objectContaining({
      type: 'Resize',
      value: '1280x720'
    }));
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: ratio });
  });

  it('emits a signed zoom percentage when the pixel ratio changes', () => {
    const originalRatio = window.devicePixelRatio;
    window.dispatchEvent(new Event('resize'));
    jasmine.clock().tick(250);

    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: originalRatio + 0.25 });
    window.dispatchEvent(new Event('resize'));
    jasmine.clock().tick(250);

    expect(traces()).toContain(jasmine.objectContaining({ type: 'Zoom', value: '+25%' }));
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: originalRatio });
  });

  it('emits tab blur and focus events from visibility changes', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(traces().map(trace => trace.type)).toEqual(['Tab-blur', 'Tab-focus']);
  });

  it('ignores events whose target is not an Element', () => {
    document.dispatchEvent(new Event('change'));

    expect(traces()).toHaveSize(0);
  });

  it('reports errors raised while processing an event', () => {
    const element = trackedElement();
    spyOn(Element.prototype, 'closest').and.throwError('dom failure');

    element.dispatchEvent(new Event('change', { bubbles: true }));

    expect(traces()).toEqual([jasmine.objectContaining({
      '@type': TRACE_TYPE_LOG,
      action: 'user-action.monitor.globalHandler',
      message: jasmine.stringMatching(/Unable to process the change user action event/)
    })]);
  });
});
