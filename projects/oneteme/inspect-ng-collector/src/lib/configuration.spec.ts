import {
  adaptedConfig, CollectorConfig, createException, createInstance, getOrCall, matchRegex,
  parseStackTrace, refreshConfig, require as requireString, requirePostitiveValue, validateAndGetConfig
} from './configuration';
import { TRACE_TYPE_COLLECTOR_CONFIGURATION, TRACE_TYPE_EXCEPTION, TraceType, UUID } from './trace.model';

describe('configuration', () => {
  const id: UUID = '00000000-0000-4000-8000-000000000001';
  let conf: CollectorConfig;

  beforeEach(() => {
    conf = {
      application: { name: 'shop', namespace: 'team', env: 'test' },
      collector: { tracing: { remote: { host: 'https://collector.example:8443' } } }
    };
  });

  describe('validation helpers', () => {
    it('resolves a provider once and preserves literal values', () => {
      const provider = jasmine.createSpy().and.returnValue('shop');
      expect(getOrCall(provider)).toBe('shop');
      expect(provider).toHaveBeenCalledTimes(1);
      expect(getOrCall(false)).toBeFalse();
      expect(getOrCall()).toBeUndefined();
    });

    it('distinguishes matching, invalid and missing strings', () => {
      const pattern = /^abc$/;
      expect(matchRegex('abc', 'key', pattern, 'fallback')).toBe('abc');
      expect(matchRegex('xyz', 'key', pattern, 'fallback')).toBe('fallback');
      expect(() => matchRegex('xyz', 'key', pattern)).toThrowError(/bad value key=xyz/);
      expect(() => matchRegex(undefined, 'key', pattern)).toThrowError('key property is required');
    });

    it('defaults only missing numbers and rejects nonpositive values and NaN', () => {
      expect(requirePostitiveValue(4, 'size', 10)).toBe(4);
      expect(requirePostitiveValue(undefined, 'size', 10)).toBe(10);
      for (const value of [0, -1, NaN]) {
        expect(() => requirePostitiveValue(value, 'size', 10)).toThrowError(/bad value size=/);
      }
    });

    it('accepts an empty but defined string', () => {
      expect(requireString('', 'key')).toBe('');
      expect(() => requireString(undefined, 'key')).toThrowError('key property is required');
    });
  });

  describe('validateAndGetConfig', () => {
    it('uses scheduling and monitoring defaults and builds both endpoints', () => {
      expect(validateAndGetConfig(conf, id)).toEqual({
        user: undefined, queueCapacity: 1000, interval: 60_000,
        instanceApi: 'https://collector.example:8443/v5/trace/instance',
        sessionApi: `https://collector.example:8443/v5/trace/instance/${id}/session`,
        exclude: [], hostExcludes: [], enabled: false, debugMode: false, analytics: false,
        resources: false, storage: false, logger: false, reporter: false,
        namespaceHeader: 'basic ' + btoa('team:')
      });
    });

    it('resolves providers and preserves configured options', () => {
      conf.application.namespace = () => 'other';
      conf.application.user = () => 'tester';
      conf.collector.tracing.remote.token = () => 'token';
      conf.collector.enabled = true;
      conf.collector.monitoring = {
        httpRoute: { excludes: { path: () => [/health/] } },
        httpRequest: { excludes: { host: ['api.example'] } }, logger: { enabled: true }
      };
      conf.collector.scheduling = { queueCapacity: 5, interval: 1234 };
      expect(validateAndGetConfig(conf, id)).toEqual(jasmine.objectContaining({
        user: 'tester', namespaceHeader: 'basic ' + btoa('other:token'), enabled: true,
        exclude: [/health/], hostExcludes: ['api.example'], logger: true, interval: 1234, queueCapacity: 5
      }));
    });

    it('falls back to localhost for a host without a scheme', () => {
      conf.collector.tracing.remote.host = 'invalid';
      expect(validateAndGetConfig(conf, id).instanceApi).toBe('http://localhost/v5/trace/instance');
    });

    it('rejects an absent namespace', () => {
      Reflect.deleteProperty(conf.application, 'namespace');
      expect(() => validateAndGetConfig(conf, id))
        .toThrowError('configuration.collector.application.namespace property is required');
    });

    it('rejects a zero interval', () => {
      conf.collector.scheduling = { interval: 0 };
      expect(() => validateAndGetConfig(conf, id)).toThrowError(/bad value interval=0/);
    });
  });

  describe('adaptedConfig', () => {
    it('converts milliseconds, retention days and regex patterns for export', () => {
      conf.collector.scheduling = { interval: 60_000 };
      conf.collector.monitoring = { httpRoute: { excludes: { path: [/health/i, /^api/] } } };
      const result = adaptedConfig(conf);
      expect(result.scheduling.interval).toBe(60);
      expect(result.monitoring.httpRoute.excludes.path).toEqual(['health', '^api']);
      expect(result.tracing.remote['@type']).toBe(TRACE_TYPE_COLLECTOR_CONFIGURATION);
      expect(result.tracing.remote.retentionMaxAge).toEqual({ audit: 604800, diagnostic: 864000 });
    });

    it('preserves an explicit zero retention', () => {
      conf.collector.monitoring = { httpRoute: { excludes: { path: [] } } };
      conf.collector.tracing.remote.retentionMaxAge = { audit: 0, diagnostics: 2 };
      expect(adaptedConfig(conf).tracing.remote.retentionMaxAge).toEqual({ audit: 0, diagnostic: 172800 });
    });

    it('exports an empty list when no route exclusions are configured', () => {
      expect(adaptedConfig(conf).monitoring.httpRoute.excludes.path).toEqual([]);
    });

    it('resolves a route exclusion provider before exporting patterns', () => {
      conf.collector.monitoring = { httpRoute: { excludes: { path: () => [/health/] } } };
      expect(adaptedConfig(conf).monitoring.httpRoute.excludes.path).toEqual(['health']);
    });
  });

  describe('createInstance', () => {
    it('persists the client address separately from the instance id and reuses it', () => {
      conf.collector.monitoring = { httpRoute: { excludes: { path: [] } } };
      const stored = new Map<string, string>();
      spyOn(Storage.prototype, 'getItem').and.callFake(key => stored.get(key) ?? null);
      const write = spyOn(Storage.prototype, 'setItem').and.callFake((key, value) => { stored.set(key, value); });
      const address = '00000000-0000-4000-8000-000000000002';
      const uuid = spyOn(crypto, 'randomUUID').and.returnValue(address);
      const first = createInstance(conf, id);
      expect(first).toEqual(jasmine.objectContaining({ id, address, name: 'shop', type: 'CLIENT', env: 'test', namespace: 'team' }));
      expect(Object.keys(first.additionalProperties ?? {})).not.toContain('branche');
      expect(Object.keys(first.additionalProperties ?? {})).not.toContain('hash');
      conf.application.branche = () => 'main';
      conf.application.hash = 'abc';
      const second = createInstance(conf, 'another-instance');
      expect(second.address).toBe(address);
      expect(second.additionalProperties).toEqual(jasmine.objectContaining({ branche: 'main', hash: 'abc' }));
      expect(write).toHaveBeenCalledOnceWith('jarvis.inspect.cid', address);
      expect(uuid).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshConfig', () => {
    it('replaces the session UUID without changing the instance endpoint', () => {
      const tech = validateAndGetConfig(conf, id);
      const endpoint = tech.instanceApi;
      const next = '00000000-0000-4000-8000-000000000002';
      expect(refreshConfig(next, tech)).toBe(next);
      expect(tech.sessionApi).toBe(`${endpoint}/${next}/session`);
      expect(tech.instanceApi).toBe(endpoint);
    });

    it('preserves URLs without a UUID', () => {
      const tech = validateAndGetConfig(conf, 'not-a-uuid');
      const original = tech.sessionApi;
      expect(refreshConfig(id, tech)).toBe(id);
      expect(tech.sessionApi).toBe(original);
    });
  });

  describe('parseStackTrace', () => {
    it('extracts named and anonymous frames, ignoring unrecognized lines', () => {
      expect(parseStackTrace('Error\n at load (app.js:12:7)\ninvalid\n at main.js:8:2')).toEqual([
        { className: 'app.js', methodName: 'load', lineNumber: 12 },
        { className: 'main.js', methodName: undefined, lineNumber: 8 }
      ]);
    });

    it('returns undefined when no frames can be parsed', () => {
      for (const stack of [undefined, '', 'Error\ninvalid']) {
        expect(parseStackTrace(stack)).toBeUndefined();
      }
    });
  });

  describe('createException', () => {
    it('preserves native error and trace metadata and parses frames only on request', () => {
      spyOn(Date, 'now').and.returnValue(1500);
      const error = new TypeError('invalid');
      error.stack = 'TypeError: invalid\n at load (app.js:12:7)';
      expect(createException(error, id, TraceType.HTTP_REQ)).toEqual({
        '@type': TRACE_TYPE_EXCEPTION, type: 'TypeError', message: 'invalid',
        traceId: id, traceType: TraceType.HTTP_REQ, offset: 1.5, stackTraceRows: undefined
      });
      expect(createException(error, id, TraceType.HTTP_REQ, true)?.stackTraceRows)
        .toEqual([{ className: 'app.js', methodName: 'load', lineNumber: 12 }]);
    });

    it('uses strings as messages and serializes objects', () => {
      expect(createException('failure', undefined, TraceType.MAIN_SES)?.message).toBe('failure');
      expect(createException({ code: 42 }, undefined, TraceType.MAIN_SES)?.message).toBe('{"code":42}');
    });

    it('returns undefined for a circular object', () => {
      const circular: { self?: object } = {};
      circular.self = circular;
      expect(createException(circular, undefined, TraceType.MAIN_SES)).toBeUndefined();
    });
  });
});
