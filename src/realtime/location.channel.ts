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

  /** ChannelWriter.TryWrite */
  write(update: LocationUpdate): boolean {
    this.buffer.push(update);
    if (this.waiterResolve) {
      const resolve = this.waiterResolve;
      this.waiterResolve = null;
      resolve(true);
    }
    return true;
  }

  /** ChannelReader.TryRead → item or null. */
  tryRead(): LocationUpdate | null {
    return this.buffer.length > 0 ? (this.buffer.shift() as LocationUpdate) : null;
  }

  /** ChannelReader.WaitToReadAsync — resolves true when an item is available, false if aborted. */
  waitToRead(signal?: AbortSignal): Promise<boolean> {
    if (this.buffer.length > 0) return Promise.resolve(true);

    return new Promise<boolean>((resolve) => {
      this.waiterResolve = resolve;
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            if (this.waiterResolve === resolve) {
              this.waiterResolve = null;
              resolve(false);
            }
          },
          { once: true },
        );
      }
    });
  }
}
