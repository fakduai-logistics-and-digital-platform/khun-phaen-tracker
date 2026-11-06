"use client";

import { useEffect, useState } from "react";

/**
 * Svelte-store compatible primitives (writable / readable / derived / get) so the ported
 * stores in lib/stores keep their original shape. React components read them with useStore().
 */
export type Subscriber<T> = (value: T) => void;
export type Unsubscriber = () => void;
export type Updater<T> = (value: T) => T;
export type StartStopNotifier<T> = (set: (value: T) => void, update: (fn: Updater<T>) => void) => void | (() => void);

export interface Readable<T> {
  subscribe(run: Subscriber<T>, invalidate?: () => void): Unsubscriber;
}
export interface Writable<T> extends Readable<T> {
  set(value: T): void;
  update(updater: Updater<T>): void;
}

type Stores = Readable<any> | [Readable<any>, ...Array<Readable<any>>] | Array<Readable<any>>;
type StoresValues<T> = T extends Readable<infer U> ? U : { [K in keyof T]: T[K] extends Readable<infer U> ? U : never };

const safeNotEqual = (a: unknown, b: unknown) =>
  a != a ? b == b : a !== b || (a !== null && typeof a === "object") || typeof a === "function";

export function readable<T>(value?: T, start?: StartStopNotifier<T>): Readable<T> {
  const { subscribe } = writable(value as T, start);
  return { subscribe };
}

export function writable<T>(value?: T, start?: StartStopNotifier<T>): Writable<T> {
  let current = value as T;
  let stop: (() => void) | void;
  const subscribers = new Set<Subscriber<T>>();

  function set(next: T) {
    if (!safeNotEqual(current, next)) return;
    current = next;
    for (const run of [...subscribers]) run(current);
  }
  function update(fn: Updater<T>) {
    set(fn(current));
  }
  function subscribe(run: Subscriber<T>): Unsubscriber {
    subscribers.add(run);
    if (subscribers.size === 1 && start) stop = start(set, update);
    run(current);
    return () => {
      subscribers.delete(run);
      if (subscribers.size === 0 && stop) {
        stop();
        stop = undefined;
      }
    };
  }
  return { set, update, subscribe };
}

export function derived<S extends Stores, T>(
  stores: S,
  fn: (values: StoresValues<S>, set: (value: T) => void, update: (fn: Updater<T>) => void) => T | void | (() => void),
  initialValue?: T,
): Readable<T> {
  const single = !Array.isArray(stores);
  const list = (single ? [stores] : stores) as Readable<any>[];
  const auto = fn.length < 2;

  return readable<T>(initialValue, (set, update) => {
    const values: unknown[] = new Array(list.length);
    let pending = 0;
    let started = false;
    let cleanup: (() => void) | void;

    const sync = () => {
      if (pending) return;
      if (typeof cleanup === "function") cleanup();
      const input = (single ? values[0] : values) as StoresValues<S>;
      const result = fn(input, set, update);
      if (auto) set(result as T);
      else cleanup = result as (() => void) | void;
    };

    const unsubs = list.map((store, i) =>
      store.subscribe((value) => {
        values[i] = value;
        pending &= ~(1 << i);
        if (started) sync();
      }),
    );
    started = true;
    sync();
    return () => {
      unsubs.forEach((u) => u());
      if (typeof cleanup === "function") cleanup();
      started = false;
    };
  });
}

export function get<T>(store: Readable<T>): T {
  let value!: T;
  store.subscribe((v) => (value = v))();
  return value;
}

/** Subscribe a React component to a store (the equivalent of Svelte's `$store`). */
export function useStore<T>(store: Readable<T>): T {
  const [value, setValue] = useState<T>(() => get(store));
  useEffect(() => store.subscribe(setValue), [store]);
  return value;
}
