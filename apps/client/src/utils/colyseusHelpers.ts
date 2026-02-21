/**
 * Typed wrappers around Colyseus `StateCallbackStrategy` methods.
 *
 * Colyseus v4's `PublicPropNames<T>` resolves to `never` for nested Schema
 * instances, making `$state.listen(instance, prop, …)` fail at compile time.
 * These helpers call the same underlying implementation while keeping the call
 * sites type-safe and free of `@ts-expect-error` / `as any`.
 */

type PropertyChangeCallback<V> = (currentValue: V, previousValue: V) => void;
type ValueKeyCallback<V, K> = (value: V, key: K) => void;

// Minimal interface matching StateCallbackStrategy's public API
interface ColyseusCallbacks {
  listen(...args: unknown[]): () => void;
  onAdd(...args: unknown[]): () => void;
  onRemove(...args: unknown[]): () => void;
  onChange(...args: unknown[]): () => void;
}

/** Listen to a property change on a nested Schema instance. */
export function schemaListen<T, K extends keyof T & string>(
  $state: ColyseusCallbacks,
  instance: T,
  property: K,
  handler: PropertyChangeCallback<T[K]>,
  immediate?: boolean,
): () => void {
  return $state.listen(instance, property, handler, immediate);
}

/** Listen when items are added to a collection property on a nested Schema. */
export function schemaOnAdd<T, K extends keyof T & string, V>(
  $state: ColyseusCallbacks,
  instance: T,
  property: K,
  handler: ValueKeyCallback<V, string>,
  immediate?: boolean,
): () => void {
  return $state.onAdd(instance, property, handler, immediate);
}

/** Listen when items are removed from a collection property on a nested Schema. */
export function schemaOnRemove<T, K extends keyof T & string, V>(
  $state: ColyseusCallbacks,
  instance: T,
  property: K,
  handler: ValueKeyCallback<V, string>,
): () => void {
  return $state.onRemove(instance, property, handler);
}

/** Listen when any property on a Schema instance changes. */
export function schemaOnChange<T>(
  $state: ColyseusCallbacks,
  instance: T,
  handler: () => void,
): () => void {
  return $state.onChange(instance, handler);
}
