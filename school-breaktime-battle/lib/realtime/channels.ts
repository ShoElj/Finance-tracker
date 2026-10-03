import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type { RoomMode } from "@/lib/session";
import { isRoomEvent, type AnyRoomEvent } from "./room-events";

/** Any message with the room envelope shape ({ type, roomCode, playerId, payload, timestamp }). */
type Envelope = { type: string; roomCode: string; playerId: string };

export type TransportStatus = "connecting" | "connected" | "reconnecting";

/** A broadcast channel shared by everyone in one room. */
export interface RoomTransport<E extends Envelope = AnyRoomEvent> {
  readonly mode: RoomMode;
  connect(): Promise<void>;
  send(event: E): void;
  subscribe(handler: (event: E) => void): () => void;
  onStatus(handler: (status: TransportStatus) => void): () => void;
  close(): void;
}

export function channelName(roomCode: string, prefix = "room"): string {
  return `${prefix}:${roomCode}`;
}

abstract class BaseTransport<E extends Envelope> implements RoomTransport<E> {
  abstract readonly mode: RoomMode;
  protected handlers = new Set<(event: E) => void>();
  protected statusHandlers = new Set<(status: TransportStatus) => void>();

  abstract connect(): Promise<void>;
  abstract send(event: E): void;
  abstract close(): void;

  subscribe(handler: (event: E) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStatus(handler: (status: TransportStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  protected emit(value: unknown): void {
    if (!isRoomEvent(value)) return;
    for (const h of this.handlers) h(value as unknown as E);
  }

  protected setStatus(status: TransportStatus): void {
    for (const h of this.statusHandlers) h(status);
  }
}

/**
 * Demo-mode transport: BroadcastChannel delivers messages between tabs of the same browser,
 * so multiplayer can be tested locally without any backend.
 */
export class LocalTransport<E extends Envelope = AnyRoomEvent> extends BaseTransport<E> {
  readonly mode = "local" as const;
  private channel: BroadcastChannel | null = null;

  constructor(
    private roomCode: string,
    private prefix = "room",
  ) {
    super();
  }

  async connect(): Promise<void> {
    if (typeof BroadcastChannel === "undefined") {
      // Very old browsers: single-tab play (practice vs bots) still works.
      this.setStatus("connected");
      return;
    }
    this.channel = new BroadcastChannel(`sbb-${channelName(this.roomCode, this.prefix)}`);
    this.channel.onmessage = (e) => this.emit(e.data);
    this.setStatus("connected");
  }

  send(event: E): void {
    this.channel?.postMessage(event);
  }

  close(): void {
    this.channel?.close();
    this.channel = null;
    this.handlers.clear();
    this.statusHandlers.clear();
  }
}

const SUPABASE_EVENT = "room_event";

/** Online transport using Supabase Realtime broadcast on the `room:{roomCode}` channel. */
export class SupabaseTransport<E extends Envelope = AnyRoomEvent> extends BaseTransport<E> {
  readonly mode = "online" as const;
  private channel: RealtimeChannel | null = null;

  constructor(
    private roomCode: string,
    private prefix = "room",
  ) {
    super();
  }

  connect(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return Promise.reject(new Error("Supabase is not configured."));
    this.setStatus("connecting");
    const channel = supabase.channel(channelName(this.roomCode, this.prefix), {
      config: { broadcast: { self: false, ack: false } },
    });
    this.channel = channel;
    channel.on("broadcast", { event: SUPABASE_EVENT }, ({ payload }) => this.emit(payload));

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Connection timed out."));
      }, 10000);
      channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          this.setStatus("connected");
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          // supabase-js keeps retrying the join; surface it so the UI can show "reconnecting".
          this.setStatus("reconnecting");
          if (!settled && status !== "CLOSED") {
            settled = true;
            clearTimeout(timeout);
            reject(err ?? new Error("Could not connect to the room."));
          }
        }
      });
    });
  }

  send(event: E): void {
    void this.channel?.send({ type: "broadcast", event: SUPABASE_EVENT, payload: event });
  }

  close(): void {
    const supabase = getSupabase();
    if (supabase && this.channel) void supabase.removeChannel(this.channel);
    this.channel = null;
    this.handlers.clear();
    this.statusHandlers.clear();
  }
}

export function createTransport<E extends Envelope = AnyRoomEvent>(
  mode: RoomMode,
  roomCode: string,
  prefix = "room",
): RoomTransport<E> {
  return mode === "online" ? new SupabaseTransport<E>(roomCode, prefix) : new LocalTransport<E>(roomCode, prefix);
}
