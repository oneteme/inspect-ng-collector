import { Event as RouterEvent, NavigationCancel, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { addReloadListener, addShutdownListener, addTraceListener, configureReporter } from './event-bus';
import { initNavigationMonitor } from './navigation.monitor';
import { SessionManager } from './session-manager.service';
import { TRACE_TYPE_LOG } from './trace.model';

describe('navigation monitor', () => {
  let browser: EventTarget;
  let router: Router;
  let session: jasmine.SpyObj<SessionManager>;
  let events: Subject<RouterEvent>[];
  let detach: Array<() => void>;

  function makeRouter(): Router {
    const stream = new Subject<RouterEvent>();
    events.push(stream);
    return jasmine.createSpyObj<Router>('Router', [], { events: stream });
  }

  beforeEach(() => {
    events = [];
    detach = [];
    browser = new EventTarget();
    router = makeRouter();
    session = jasmine.createSpyObj<SessionManager>('SessionManager', [
      'navigate', 'validateSession', 'hasValidateSessionBeenCalled'
    ]);
    spyOnProperty(SessionManager, 'instance').and.returnValue(session);
    const browserAdd = window.addEventListener.bind(window);
    spyOn(window, 'addEventListener').and.callFake(
      (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        if (type === 'pageshow' || type === 'beforeunload') browser.addEventListener(type, listener, options);
        else browserAdd(type, listener, options);
      }
    );
  });

  afterEach(() => {
    events.forEach(stream => stream.complete());
    detach.forEach(remove => remove());
    configureReporter(false);
  });

  it('starts a startup session and handles each navigation event only once', () => {
    initNavigationMonitor(router);
    initNavigationMonitor(router);

    expect(session.navigate).toHaveBeenCalledOnceWith(new URL(document.URL).origin);
    expect(session.validateSession).toHaveBeenCalledOnceWith(false);
    events[0].next(new NavigationStart(1, '/items'));
    events[0].next(new NavigationEnd(1, '/items', '/items'));
    events[0].next(new NavigationCancel(2, '/cart', 'cancelled'));

    expect(session.navigate.calls.allArgs()).toEqual([[new URL(document.URL).origin], ['/items']]);
    expect(session.validateSession.calls.allArgs()).toEqual([[false], [true, 0], [true, 0]]);
  });

  it('unsubscribes from the old router when the router changes', () => {
    initNavigationMonitor(router);
    initNavigationMonitor(makeRouter());
    session.navigate.calls.reset();

    events[0].next(new NavigationStart(1, '/ignored'));
    events[1].next(new NavigationStart(2, '/active'));

    expect(session.navigate).toHaveBeenCalledOnceWith('/active');
  });

  it('reloads before restoring a page from the back-forward cache', () => {
    const reloaded = jasmine.createSpy('reloaded');
    detach.push(addReloadListener(reloaded));
    initNavigationMonitor(router);
    session.navigate.calls.reset();
    session.validateSession.calls.reset();

    browser.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    expect(reloaded).not.toHaveBeenCalled();
    expect(session.navigate).not.toHaveBeenCalled();

    browser.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(reloaded).toHaveBeenCalledTimes(1);
    expect(reloaded).toHaveBeenCalledBefore(session.navigate);
    expect(session.navigate).toHaveBeenCalledOnceWith(document.URL);
    expect(session.validateSession).toHaveBeenCalledOnceWith(true, 0);
  });

  for (const validated of [true, false]) {
    it(`shuts down on unload with a ${validated ? 'validated' : 'pending'} session`, () => {
      const shutdown = jasmine.createSpy('shutdown');
      detach.push(addShutdownListener(shutdown));
      initNavigationMonitor(router);
      session.navigate.calls.reset();
      session.hasValidateSessionBeenCalled.and.returnValue(validated);

      browser.dispatchEvent(new Event('beforeunload'));

      expect(shutdown).toHaveBeenCalledTimes(1);
      if (validated) {
        expect(session.navigate).toHaveBeenCalledOnceWith();
        expect(session.navigate).toHaveBeenCalledBefore(shutdown);
      } else {
        expect(session.navigate).not.toHaveBeenCalled();
      }
    });
  }

  it('reports startup failures without subscribing to navigation', () => {
    const report = jasmine.createSpy('report');
    detach.push(addTraceListener(event => report(...(event as CustomEvent).detail.traces)));
    configureReporter(true);
    session.navigate.and.throwError('startup failed');

    initNavigationMonitor(router);
    events[0].next(new NavigationStart(1, '/ignored'));

    expect(session.navigate).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      '@type': TRACE_TYPE_LOG, action: 'navigation.monitor.initNavigationMonitor'
    }));
  });
});
