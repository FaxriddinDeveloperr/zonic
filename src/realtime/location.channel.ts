// Mirrors Zonic.Api/Services/LocationChannel.cs — an unbounded single-reader queue
// (System.Threading.Channels.Channel<LocationUpdate>). Registered as a Nest singleton.
import { Injectable } from '@nestjs/common';

export interface LocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  timestamp: Date;
  runTypeId: number;
}

@Injectable()
export class LocationChannel {
  private buffer: LocationUpdate[] = [];
  private waiterResolve: ((value: boolean) => void) | null = null;
  // Removes the current waiter's abort listener; cleared once the waiter settles.
  private waiterCleanup: (() => void) | null = null;

  /** ChannelWriter.TryWrite */
  write(update: LocationUpdate): boolean {
    this.buffer.push(update);
    if (this.waiterResolve) {
      const resolve = this.waiterResolve;
      this.settleWaiter();
      resolve(true);
    }
    return true;
  }

  /** ChannelReader.TryRead → item or null. */
  tryRead(): LocationUpdate | null {
    return this.buffer.length > 0 ? (this.buffer.shift() as LocationUpdate) : null;
  }

  /** Number of items still buffered (not yet read). */
  pending(): number {
    return this.buffer.length;
  }

  /** ChannelReader.WaitToReadAsync — resolves true when an item is available, false if aborted. */
  waitToRead(signal?: AbortSignal): Promise<boolean> {
    if (this.buffer.length > 0) return Promise.resolve(true);

    return new Promise<boolean>((resolve) => {
      this.waiterResolve = resolve;
      if (signal) {
        const onAbort = (): void => {
          if (this.waiterResolve === resolve) {
            this.settleWaiter();
            resolve(false);
          }
        };
        signal.addEventListener('abort', onAbort, { once: true });
        // Remove the listener when the waiter settles normally (no leak on idle→active cycles).
        this.waiterCleanup = () => signal.removeEventListener('abort', onAbort);
      }
    });
  }

  /** Clear the pending waiter and detach its abort listener. */
  private settleWaiter(): void {
    this.waiterResolve = null;
    if (this.waiterCleanup) {
      this.waiterCleanup();
      this.waiterCleanup = null;
    }
  }
}
