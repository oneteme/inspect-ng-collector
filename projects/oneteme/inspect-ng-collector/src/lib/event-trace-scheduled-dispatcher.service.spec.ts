import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { validateAndGetConfig } from './configuration';
import { addExportListener, dispatchShutown, dispatchTraces, WIN } from './event-bus';
import { eventTraceScheduledDispatcher } from './event-trace-scheduled-dispatcher.service';
import { InstanceEnvironment } from './trace.model';

describe('event trace scheduled dispatcher', () => {
  const instance: InstanceEnvironment = { id: 'test-instance', namespace: 'team', resource: {} };
  const tech = validateAndGetConfig({
    application: { name: 'shop', namespace: 'team', env: 'test' },
    collector: {
      scheduling: { interval: 1000, queueCapacity: 2 },
      tracing: { remote: { host: 'https://collector.example' } }
    }
  }, instance.id);
  const first = { id: 'first' };
  const second = { id: 'second' };
  const third = { id: 'third' };
  let fetchSpy: jasmine.Spy<typeof fetch>;
  let dispatcher: ReturnType<typeof eventTraceScheduledDispatcher>;

  function respond(status = 200, headers?: HeadersInit): void {
    fetchSpy.and.callFake(() => Promise.resolve(new Response(null, { status, headers })));
  }

  function request(index: number) {
    const [url, options] = fetchSpy.calls.argsFor(index);
    return { url: new URL(String(url)), options };
  }

  function registerInstance(status = 200): void {
    respond(status);
    dispatcher.trace(instance);
    flushMicrotasks();
  }

  function run(name: string, test: () => void): void {
    it(name, fakeAsync(() => {
      fetchSpy = spyOn(window, 'fetch');
      respond();
      dispatcher = eventTraceScheduledDispatcher(tech);
      try {
        test();
      } finally {
        respond();
        dispatcher.destroy();
        flushMicrotasks();
      }
    }));
  }

  run('registers the instance before sending queued traces', () => {
    let finishRegistration!: (response: Response) => void;
    fetchSpy.and.returnValue(new Promise(resolve => { finishRegistration = resolve; }));
    dispatcher.trace(instance);
    dispatchTraces(first);
    void dispatcher.dispatch();

    expect(fetchSpy).toHaveBeenCalledOnceWith(`${tech.instanceApi}?atm=1`, {
      method: 'PUT', mode: 'cors', keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: tech.namespaceHeader },
      body: JSON.stringify(instance)
    });

    finishRegistration(new Response(null, { status: 409 }));
    flushMicrotasks();
    respond();
    void dispatcher.dispatch();
    flushMicrotasks();

    expect(request(1).url.href).toBe(`${tech.sessionApi}?atm=1&seq=1`);
    expect(request(1).options?.body).toBe(JSON.stringify([first]));
  });

  run('keeps queued traces until a failed instance registration is retried successfully', () => {
    registerInstance(503);
    dispatchTraces(first);
    const failed = jasmine.createSpy('failed');
    let sent = false;
    void dispatcher.dispatch().then(() => { sent = true; }, failed);
    flushMicrotasks();

    expect(failed).toHaveBeenCalledOnceWith(jasmine.any(Error));
    expect(sent).toBeFalse();
    expect(fetchSpy.calls.allArgs().map(([url]) => url)).toEqual([
      `${tech.instanceApi}?atm=1`, `${tech.instanceApi}?atm=2`
    ]);

    respond();
    void dispatcher.dispatch();
    flushMicrotasks();
    expect(request(2).url.href).toBe(`${tech.instanceApi}?atm=3`);
    expect(request(3).url.href).toBe(`${tech.sessionApi}?atm=1&seq=1`);
    expect(request(3).options?.body).toBe(JSON.stringify([first]));
  });

  run('collects export traces on the scheduled tick and sends them in one batch', () => {
    registerInstance();
    dispatchTraces(first);
    const onExport = jasmine.createSpy('export').and.callFake(() => dispatchTraces(second));
    addExportListener(onExport);
    try {
      tick(tech.interval - 1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      tick(1);

      expect(onExport).toHaveBeenCalledTimes(1);
      expect(request(1).url.href).toBe(`${tech.sessionApi}?atm=1&seq=1`);
      expect(request(1).options?.body).toBe(JSON.stringify([first, second]));
    } finally {
      (WIN['event-bus'] as EventTarget).removeEventListener('export', onExport);
    }
  });

  run('skips the network when there are no traces to send', () => {
    registerInstance();
    void dispatcher.dispatch();
    flushMicrotasks();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  run('retries the same packet before sending newer traces under a new sequence', () => {
    registerInstance();
    respond(503);
    dispatchTraces(first);
    void dispatcher.dispatch();
    flushMicrotasks();
    dispatchTraces(second);

    respond(409);
    void dispatcher.dispatch();
    flushMicrotasks();
    expect(request(2).url.href).toBe(`${tech.sessionApi}?atm=2&seq=1`);
    expect(request(2).options?.body).toBe(request(1).options?.body);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    respond();
    void dispatcher.dispatch();
    flushMicrotasks();
    expect(request(3).url.href).toBe(`${tech.sessionApi}?atm=1&seq=2`);
    expect(request(3).options?.body).toBe(JSON.stringify([second]));
  });

  for (const { status, headers } of [
    { status: 409, headers: undefined },
    { status: 503, headers: { 'Inspect-Trace-Retry': '0' } }
  ]) {
    run(`does not retry a new packet after HTTP ${status}${headers ? ' with retry disabled' : ''}`, () => {
      registerInstance();
      respond(status, headers);
      dispatchTraces(first);
      void dispatcher.dispatch();
      flushMicrotasks();

      respond();
      dispatchTraces(second);
      void dispatcher.dispatch();
      flushMicrotasks();

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(request(2).url.searchParams.get('seq')).toBe('2');
      expect(request(2).options?.body).toBe(JSON.stringify([second]));
    });
  }

  run('drops a pending packet after repeated network failure when the combined queue exceeds capacity', () => {
    registerInstance();
    fetchSpy.and.callFake(() => Promise.reject(new TypeError('offline')));
    dispatchTraces(first);
    void dispatcher.dispatch();
    flushMicrotasks();
    dispatchTraces(second, third);
    void dispatcher.dispatch();
    flushMicrotasks();
    expect(request(2).options?.body).toBe(JSON.stringify([first]));

    respond();
    void dispatcher.dispatch();
    flushMicrotasks();
    expect(request(3).url.href).toBe(`${tech.sessionApi}?atm=1&seq=2`);
    expect(request(3).options?.body).toBe(JSON.stringify([second, third]));
  });

  run('shares an in-flight batch across overlapping dispatch calls', () => {
    registerInstance();
    let finish!: (response: Response) => void;
    fetchSpy.and.returnValue(new Promise(resolve => { finish = resolve; }));
    dispatchTraces(first);
    const pending = dispatcher.dispatchTraces();
    dispatchTraces(second);

    expect(dispatcher.dispatchTraces()).toBe(pending);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    finish(new Response(null, { status: 200 }));
    flushMicrotasks();

    respond();
    void dispatcher.dispatch();
    flushMicrotasks();
    expect(request(2).options?.body).toBe(JSON.stringify([second]));
  });

  run('flushes only new traces if shutdown occurs during an in-flight batch', () => {
    registerInstance();
    let finish!: (response: Response) => void;
    fetchSpy.and.returnValue(new Promise(resolve => { finish = resolve; }));
    dispatchTraces(first);
    void dispatcher.dispatch();

    respond();
    dispatchTraces(second);
    dispatchShutown();
    dispatchTraces(third);
    dispatchShutown();
    finish(new Response(null, { status: 200 }));
    flushMicrotasks();
    tick(tech.interval * 2);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const final = request(2);
    expect(final.url.searchParams.get('seq')).toBe('2');
    expect(final.url.searchParams.get('end')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(final.options?.keepalive).toBeTrue();
    expect(final.options?.body).toBe(JSON.stringify([second]));
    expect(dispatcher.subscription.closed).toBeTrue();
  });

  run('prioritizes reinserted traces when the combined queue exceeds capacity', () => {
    dispatchTraces(third);
    dispatcher.revertQueueSize([first, second]);

    expect(dispatcher.traceQueue).toEqual([first, second]);
  });
});
