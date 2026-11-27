import { LocalRequestMonitor } from './local-request.monitor';
import { TraceableStage } from './traceable-stage.decorator';
import { TRACE_TYPE_EXCEPTION, TraceType } from './trace.model';

describe('TraceableStage', () => {
  let preProcess: jasmine.Spy<LocalRequestMonitor['preProcess']>;
  let postProcess: jasmine.Spy<LocalRequestMonitor['postProcess']>;

  class Cart {
    constructor(private readonly quantity: number) {}

    @TraceableStage()
    total(price: number, discount: number): number {
      return this.quantity * price - discount;
    }

    @TraceableStage()
    fail(error: Error): never {
      throw error;
    }

    @TraceableStage()
    resolve(result: Promise<number>): Promise<number> {
      return result;
    }
  }

  beforeEach(() => {
    preProcess = spyOn(LocalRequestMonitor.prototype, 'preProcess');
    postProcess = spyOn(LocalRequestMonitor.prototype, 'postProcess');
  });

  it('preserves the method receiver, arguments and return value', () => {
    expect(new Cart(3).total(10, 5)).toBe(25);
    expect(preProcess).toHaveBeenCalledOnceWith('total', Cart.prototype);
    expect(postProcess).toHaveBeenCalledOnceWith(undefined);
    expect(preProcess).toHaveBeenCalledBefore(postProcess);
    expect(postProcess.calls.mostRecent().object).toBe(preProcess.calls.mostRecent().object);
  });

  it('finalizes a failed invocation with a local exception and rethrows the original error', () => {
    const error = new TypeError('invalid cart');

    expect(() => new Cart(1).fail(error)).toThrow(error);
    expect(postProcess).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      '@type': TRACE_TYPE_EXCEPTION, type: 'TypeError', message: 'invalid cart',
      traceType: TraceType.LCL_RQT, stackTraceRows: undefined
    }));
    expect(preProcess).toHaveBeenCalledBefore(postProcess);
  });

  it('returns a promise unchanged and finalizes when the method returns', () => {
    const promise = Promise.resolve(7);

    expect(new Cart(1).resolve(promise)).toBe(promise);
    expect(postProcess).toHaveBeenCalledOnceWith(undefined);
  });
});
