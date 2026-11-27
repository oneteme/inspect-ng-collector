import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ErrorHandler, Injector, Provider } from '@angular/core';
import { Router } from '@angular/router';
import { defer, NEVER, Subject, takeUntil } from 'rxjs';
import { CollectorConfig, TechnicalConf, validateAndGetConfig } from './configuration';
import { addTraceListener, configureReporter, dispatchReload, dispatchReport, dispatchShutown, WIN } from './event-bus';
import { GlobalErrorHandler } from './global-error-handler.service';
import { HttpInterceptorService } from './http-interceptor.service';
import { initializeCollector, initializeEventsFactory, NgCollectorModule, reloadCollector } from './ng-collector.module';
import { SessionManager } from './session-manager.service';
import { TRACE_TYPE_LOG } from './trace.model';

describe('NgCollectorModule', () => {
  const instanceId = '00000000-0000-4000-8000-000000000001';
  const reloadedId = '00000000-0000-4000-8000-000000000002';
  const configuration = (enabled = true): CollectorConfig => ({
    application: { name: 'shop', namespace: 'team', env: 'test' },
    collector: { enabled, tracing: { remote: { host: 'https://collector.example' } } }
  });
  const eventConfig = (flags: Partial<TechnicalConf> = {}) => ({
    tech: { ...validateAndGetConfig(configuration(), instanceId), ...flags },
    instance: { id: instanceId, namespace: 'team', resource: {} }
  });

  let router: Router;
  let stopNavigation: Subject<void>;
  let subscribeToNavigation: jasmine.Spy;
  let fetchSpy: jasmine.Spy<typeof fetch>;
  let randomUuid: jasmine.Spy<typeof crypto.randomUUID>;
  let initializeSession: jasmine.Spy<typeof SessionManager.initialize>;
  let activeSession: SessionManager;
  let previousGlobalSession: PropertyDescriptor | undefined;
  let bus: EventTarget;
  let busListeners: Array<[string, EventListenerOrEventListenerObject]>;
  let addBusListener: jasmine.Spy<EventTarget['addEventListener']>;

  beforeEach(() => {
    activeSession = new SessionManager(eventConfig().tech);
    previousGlobalSession = Object.getOwnPropertyDescriptor(WIN, 'inspect-session-manager');
    initializeSession = spyOn(SessionManager, 'initialize').and.callFake(tech => {
      activeSession = new SessionManager(tech);
      return activeSession;
    });
    spyOnProperty(SessionManager, 'instance').and.callFake(() => activeSession);
    randomUuid = spyOn(crypto, 'randomUUID').and.returnValue(instanceId);
    spyOn(Storage.prototype, 'getItem').and.returnValue(instanceId);
    // Keep requests in flight to exercise dispatch without live I/O or retries.
    fetchSpy = spyOn(window, 'fetch').and.callFake(() => new Promise<Response>(() => {}));

    stopNavigation = new Subject<void>();
    subscribeToNavigation = jasmine.createSpy('subscribeToNavigation');
    router = jasmine.createSpyObj<Router>('Router', [], {
      events: defer(() => {
        subscribeToNavigation();
        return NEVER;
      }).pipe(takeUntil(stopNavigation))
    });
    const addWindowListener = window.addEventListener.bind(window);
    spyOn(window, 'addEventListener').and.callFake((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      if (!['pageshow', 'beforeunload', 'scroll', 'resize'].includes(type)) {
        addWindowListener(type, listener, options);
      }
    });

    bus = WIN['event-bus'];
    busListeners = [];
    const addListener = bus.addEventListener.bind(bus);
    addBusListener = spyOn(bus, 'addEventListener').and.callFake((type, listener, options) => {
      if (listener) busListeners.push([type, listener]);
      addListener(type, listener, options);
    });
  });

  afterEach(() => {
    stopNavigation.next();
    stopNavigation.complete();
    dispatchShutown();
    busListeners.forEach(([type, listener]) => bus.removeEventListener(type, listener));
    configureReporter(false);
    if (previousGlobalSession) {
      Object.defineProperty(WIN, 'inspect-session-manager', previousGlobalSession);
    } else {
      Reflect.deleteProperty(WIN, 'inspect-session-manager');
    }
  });

  it('returns the module without providers or startup effects when disabled', () => {
    expect(NgCollectorModule.forRoot(configuration(false))).toEqual({ ngModule: NgCollectorModule, providers: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(initializeSession).not.toHaveBeenCalled();
  });

  it('resolves the enabled collector providers through Angular DI', () => {
    const registration = NgCollectorModule.forRoot(configuration());
    const providers = (registration.providers ?? []).filter((provider): provider is Provider =>
      typeof provider === 'object' && provider !== null && 'provide' in provider
    );
    const injector = Injector.create({ providers });

    expect(registration.ngModule).toBe(NgCollectorModule);
    expect(injector.get(HTTP_INTERCEPTORS)).toEqual([jasmine.any(HttpInterceptorService)]);
    expect(injector.get(ErrorHandler)).toBeInstanceOf(GlobalErrorHandler);
  });

  it('warns and omits providers when enabled with invalid configuration', () => {
    const config = configuration();
    Reflect.deleteProperty(config.application, 'namespace');
    const warn = spyOn(console, 'warn');

    expect(NgCollectorModule.forRoot(config).providers).toEqual([]);
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/Ng-collector is disabled/));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(initializeSession).not.toHaveBeenCalled();
  });

  it('requires both configuration and a router before starting navigation monitoring', () => {
    const config = eventConfig();
    new NgCollectorModule(null, router);
    new NgCollectorModule(config, null);
    expect(subscribeToNavigation).not.toHaveBeenCalled();
    expect(addBusListener).not.toHaveBeenCalledWith('reload', jasmine.any(Function));

    new NgCollectorModule(config, router);
    expect(subscribeToNavigation).toHaveBeenCalledTimes(1);
    expect(addBusListener).toHaveBeenCalledWith('reload', jasmine.any(Function));
  });

  it('starts navigation without registering optional monitors when their flags are off', () => {
    const addDocumentListener = spyOn(document, 'addEventListener').and.callThrough();
    const warn = console.warn;
    const error = console.error;

    initializeEventsFactory(eventConfig(), router)();

    expect(subscribeToNavigation).toHaveBeenCalledTimes(1);
    expect(addDocumentListener).not.toHaveBeenCalledWith('click', jasmine.any(Function), true);
    expect(addBusListener).not.toHaveBeenCalledWith('export', jasmine.any(Function));
    expect(console.warn).toBe(warn);
    expect(console.error).toBe(error);
  });

  it('registers analytics listeners only once for the same technical configuration', () => {
    const addDocumentListener = spyOn(document, 'addEventListener');
    spyOnProperty(document, 'readyState').and.returnValue('complete');
    const initialize = initializeEventsFactory(eventConfig({ analytics: true }), router);

    initialize();
    initialize();

    expect(addDocumentListener.calls.allArgs().filter(([type]) => type === 'click')).toEqual([
      ['click', jasmine.any(Function), true]
    ]);
    expect(addBusListener).not.toHaveBeenCalledWith('export', jasmine.any(Function));
    dispatchReload();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('registers resource monitoring when enabled and browser memory metrics are available', () => {
    const needsMemoryStub = !('memory' in performance);
    if (needsMemoryStub) Object.defineProperty(performance, 'memory', { configurable: true, value: {} });

    try {
      initializeEventsFactory(eventConfig({ resources: true }), router)();
      expect(addBusListener).toHaveBeenCalledWith('export', jasmine.any(Function));
    } finally {
      if (needsMemoryStub) Reflect.deleteProperty(performance, 'memory');
    }
  });

  it('applies the reporter flag even when the monitors have already been initialized', () => {
    const config = eventConfig({ reporter: true });
    const initialize = initializeEventsFactory(config, router);
    const reported = jasmine.createSpy('reported');
    addTraceListener(event => {
      for (const trace of (event as CustomEvent).detail.traces) {
        if (trace['@type'] === TRACE_TYPE_LOG) reported(trace);
      }
    });

    initialize();
    dispatchReport('visible diagnostic', 'test');
    config.tech.reporter = false;
    initialize();
    dispatchReport('hidden diagnostic', 'test');

    expect(reported).toHaveBeenCalledOnceWith(jasmine.objectContaining({ action: 'test', message: 'visible diagnostic ' }));
  });

  it('uses the latest configuration when a reload is dispatched', () => {
    const first = eventConfig();
    const latest = eventConfig();
    initializeEventsFactory(first, router)();
    initializeEventsFactory(latest, router)();
    randomUuid.and.returnValue(reloadedId);

    dispatchReload();

    expect(first.instance.id).toBe(instanceId);
    expect(latest.instance.id).toBe(reloadedId);
    expect(initializeSession).toHaveBeenCalledOnceWith(latest.tech);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('creates and submits an instance using the same ID as the session URL', () => {
    const config = initializeCollector(configuration());

    expect(config.instance.id).toBe(instanceId);
    expect(config.tech.sessionApi).toBe(`${config.tech.instanceApi}/${instanceId}/session`);
    expect(initializeSession).toHaveBeenCalledOnceWith(config.tech);
    const [url, options] = fetchSpy.calls.mostRecent().args;
    expect(url).toBe(`${config.tech.instanceApi}?atm=1`);
    expect(options?.method).toBe('PUT');
    expect(options?.body).toBe(JSON.stringify(config.instance));
  });

  it('refreshes the session URL and resubmits the instance with a new ID', () => {
    const config = eventConfig();
    const instanceApi = config.tech.instanceApi;
    randomUuid.and.returnValue(reloadedId);

    reloadCollector(config);

    expect(config.instance.id).toBe(reloadedId);
    expect(config.tech.instanceApi).toBe(instanceApi);
    expect(config.tech.sessionApi).toBe(`${instanceApi}/${reloadedId}/session`);
    expect(initializeSession).toHaveBeenCalledOnceWith(config.tech);
    expect(fetchSpy).toHaveBeenCalledOnceWith(`${instanceApi}?atm=1`, jasmine.objectContaining({
      method: 'PUT', body: JSON.stringify(config.instance)
    }));
  });
});
