import type Entity from "./entity";

/**
 * Abstract base class for components that can be attached to entities.
 * Components provide functionality to entities and can respond to lifecycle events through virtual methods.
 *
 * Key features:
 * - Belongs to exactly one entity
 * - Method-based architecture with `onTick` and `onEnabledChanged` virtual methods
 * - Enabled/disabled state that respects entity state
 * - Automatic registration with the entity upon construction
 *
 * @example
 * ```typescript
 * class TransformComponent extends Component {
 *   x = 0;
 *   y = 0;
 *
 *   protected onTick(deltaTime: number): void {
 *     // Update position based on deltaTime
 *   }
 * }
 *
 * const entity = new Entity({ id: 'player' });
 * const transform = new TransformComponent(entity);
 * ```
 */
export default abstract class Component {
	/** The entity this component belongs to. Set automatically during construction and cannot be changed. */
	readonly entity!: Entity;
	private _enabledSelf: boolean;

	/**
	 * Whether to add this component to the entity's type map for optimized lookups.
	 *
	 * - `false` (default): Component is NOT added to the type map. Lookups will fall back to iteration, which is slower
	 *   but avoids the overhead of maintaining the map for components that are rarely looked up by type.
	 * - `true`: Component is added to the type map, enabling fast O(1) lookups via `entity.getComponentByType()`.
	 *
	 * @default false
	 */
	readonly precacheTypeLookup: boolean;

	/**
	 * Creates a new Component instance and attaches it to the specified entity.
	 * The component is automatically registered with the entity and cannot be moved to another entity.
	 *
	 * @param entity - The entity this component belongs to. Required and cannot be changed after construction.
	 * @param preset - Optional configuration object for the component.
	 * @param preset.enabledSelf - Whether the component is enabled by default. Defaults to `true`.
	 * @param preset.precacheTypeLookup - Whether to add this component to the entity's type map for optimized lookups.
	 *   Defaults to `false` (component is NOT added to map, uses slower iteration-based lookups). Set to `true` to add
	 *   the component to the map for fast O(1) lookups via `entity.getComponentByType()`.
	 *
	 * @example
	 * ```typescript
	 * class MyComponent extends Component {
	 *   constructor(entity: Entity) {
	 *     super(entity, { enabledSelf: true });
	 *   }
	 * }
	 *
	 * const entity = new Entity({ id: 'entity' });
	 * const component = new MyComponent(entity);
	 *
	 * // Component is NOT added to type map by default (slower lookups)
	 * const found = entity.getComponentByType(MyComponent);
	 *
	 * // Add to type map for components frequently looked up by type (fast lookups)
	 * const transform = new TransformComponent(entity, { precacheTypeLookup: true });
	 * const foundTransform = entity.getComponentByType(TransformComponent); // Fast O(1) lookup
	 * ```
	 */
	constructor(
		entity: Entity,
		preset: { enabledSelf?: boolean; precacheTypeLookup?: boolean } = {},
	) {
		this._enabledSelf = preset.enabledSelf ?? true;
		this.precacheTypeLookup = preset.precacheTypeLookup ?? false;
		this.entity = entity;
		// biome-ignore lint/suspicious/noExplicitAny: Override private guard
		(entity as any)._components.push(this);
		// Update component type map for optimized lookups
		if (this.precacheTypeLookup) {
			// biome-ignore lint/suspicious/noExplicitAny: Override private guard
			const map = (entity as any)._componentMap;
			const ctor = this.constructor;

			// make sure the component is not already in the map
			if (!map.has(ctor)) {
				map.set(ctor, this);
			}
		}
	}

	/**
	 * Gets whether this component itself is enabled, independent of its entity's state.
	 * @returns `true` if this component is enabled, `false` otherwise.
	 */
	get enabledSelf() {
		return this._enabledSelf;
	}

	/**
	 * Sets whether this component itself is enabled. When the effective enabled state changes (considering both this value and the entity's enabled state),
	 * the `onEnabledChanged` method will be called.
	 * @param value - `true` to enable this component, `false` to disable it.
	 */
	set enabledSelf(value: boolean) {
		if (value === this._enabledSelf) return;
		const oldEnabled = this.enabled;
		this._enabledSelf = value;
		const enabled = this.enabled;
		if (enabled !== oldEnabled) {
			this.onEnabledChanged(enabled);
		}
	}

	/**
	 * Virtual method called when the component is ticked during the entity update cycle.
	 * Override this method in derived classes to implement tick-based logic.
	 * @param deltaTime - The time elapsed since the last tick in milliseconds.
	 */
	protected onTick(_deltaTime: number): void { }

	/**
	 * Virtual method called when the component's effective enabled state changes.
	 * Override this method in derived classes to respond to enabled state changes.
	 * @param newValue - The new effective enabled state of the component.
	 */
	protected onEnabledChanged(_newValue: boolean): void { }

	/**
	 * Gets the effective enabled state of this component, considering both its own `enabledSelf` value and its entity's enabled state.
	 * @returns `true` only if both this component's `enabledSelf` is `true` and its entity's `enabled` is `true`.
	 */
	get enabled() {
		return this._enabledSelf && this.entity.enabled;
	}

	/**
	 * Destroys this component, removing it from its entity and marking it as "dead".
	 *
	 * After calling `destroy()`, the component is permanently removed from the entity's component list
	 * and its entity reference is cleared. The component should be considered "dead" and must not be
	 * accessed or used in any way after destruction.
	 *
	 * **CRITICAL**: After calling `destroy()`, you must:
	 * - Remove all references to this component from your code
	 * - Never access the component's properties or methods again
	 * - Never call any methods on the component
	 *
	 * Accessing a destroyed component will result in undefined behavior. In non-production builds,
	 * the component object is frozen to help detect misuse.
	 *
	 * @example
	 * ```typescript
	 * const component = new MyComponent(entity);
	 *
	 * // Use the component...
	 * component.doSomething();
	 *
	 * // Destroy the component when no longer needed
	 * component.destroy();
	 *
	 * // IMPORTANT: Remove all references and never access it again
	 * // component = null; // or let it go out of scope
	 * // DO NOT: component.doSomething(); // ❌ WRONG - component is dead
	 * ```
	 */
	destroy(): void {
		// biome-ignore lint/suspicious/noExplicitAny: override private guard
		const entity: any = this.entity;
		if (entity === undefined) return;

		const idx = entity._components.indexOf(this);
		entity._components.splice(idx, 1);

		const map = entity._componentMap;
		if (map.get(this.constructor) === this) {
			map.delete(this.constructor);
		}

		// biome-ignore lint/suspicious/noExplicitAny: override private guard
		(this as any).entity = undefined;

		if (process.env.NODE_ENV !== "production") {
			Object.freeze(this); // make future misuse obvious
		}
	}
}
