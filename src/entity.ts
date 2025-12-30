import type Component from "./component";

/**
 * Represents an entity in a hierarchical tree structure that can contain child entities and components.
 * Entities form the backbone of the component framework, allowing you to build flexible hierarchies
 * where each entity can have multiple components attached to it.
 *
 * Key features:
 * - Hierarchical parent-child relationships
 * - Cascading enabled/disabled state management with caching
 * - Component attachment and management
 * - Efficient traversal of entities and components
 * - Method-based architecture through component virtual methods
 *
 * @example
 * ```typescript
 * const root = new Entity({ id: 'root' });
 * const child = new Entity({ id: 'child', parent: root });
 * root.addChild(child);
 * ```
 */
export default class Entity {
	private _children: Entity[] = [];
	private _parent: Entity | null = null;
	private _enabledSelf: boolean = true;
	private _enabledCache: boolean | null = null; // Cache for enabled property
	/** Unique identifier for this entity. Can be a string or number. If not provided in constructor, an auto-incrementing number is assigned. */
	readonly id: string | number;
	private static _idCounter: number = Number.MIN_SAFE_INTEGER;
	private readonly _components: Component[] = [];
	// biome-ignore lint/complexity/noBannedTypes: On purpose, we need to support any constructor
	private readonly _componentMap = new Map<Function, Component>();

	/**
	 * Creates a new Entity instance.
	 * @param preset - Optional configuration object for the entity.
	 * @param preset.id - Optional unique identifier. If not provided, an auto-incrementing number is assigned.
	 * @param preset.enabledSelf - Whether the entity is enabled by default. Defaults to `true`.
	 * @param preset.parent - Optional parent entity. If provided, this entity will be added as a child of the parent.
	 *
	 * @example
	 * ```typescript
	 * // Create a root entity with a custom ID
	 * const root = new Entity({ id: 'scene' });
	 *
	 * // Create a child entity with a parent
	 * const child = new Entity({ id: 'player', parent: root, enabledSelf: true });
	 *
	 * // Create an entity that will be auto-assigned an ID
	 * const entity = new Entity();
	 * ```
	 */
	constructor(
		preset: { id?: string; enabledSelf?: boolean; parent?: Entity } = {},
	) {
		this.id = preset.id ?? Entity._idCounter++;
		this._enabledSelf = preset.enabledSelf ?? true;
		if (preset.parent) {
			this.setParent(preset.parent);
		}
	}

	/**
	 * Gets whether this entity itself is enabled, independent of its parent's state.
	 * @returns `true` if this entity is enabled, `false` otherwise.
	 */
	get enabledSelf() {
		return this._enabledSelf;
	}

	/**
	 * Sets whether this entity itself is enabled. When set to `false`, this entity and all its descendants become disabled.
	 * Invalidates the enabled cache for this entity and all descendants, and calls `onEnabledChanged` on affected components.
	 * @param value - `true` to enable this entity, `false` to disable it.
	 */
	set enabledSelf(value: boolean) {
		if (value === this._enabledSelf) return;
		const oldEnabled = this.enabled;
		this._enabledSelf = value;
		// Invalidate enabled cache for this entity and all descendants
		this._invalidateEnabledCache();
		const newEnabled = this.enabled;
		if (newEnabled === oldEnabled) {
			return;
		}
		for (const component of this._components) {
			if (component.enabledSelf) {
				// biome-ignore lint/suspicious/noExplicitAny: Override protected guard
				(component as any).onEnabledChanged(newEnabled);
			}
		}

		for (const child of this.traverseChildren((child) => child.enabledSelf)) {
			for (const component of child._components) {
				if (component.enabledSelf) {
					// biome-ignore lint/suspicious/noExplicitAny: Override protected guard
					(component as any).onEnabledChanged(newEnabled);
				}
			}
		}
	}

	/**
	 * Gets the effective enabled state of this entity, considering both its own `enabledSelf` value and all parent entities' enabled states.
	 * The result is cached for performance and automatically invalidated when necessary.
	 * @returns `true` only if this entity's `enabledSelf` is `true` and all parent entities (up to the root) have `enabledSelf` set to `true`.
	 */
	get enabled() {
		// Return cached value if available
		if (this._enabledCache !== null) {
			return this._enabledCache;
		}
		// iterate through self and parents until a parent is found false
		let current: Entity | null = this;
		while (current) {
			if (!current.enabledSelf) {
				this._enabledCache = false;
				return false;
			}
			current = current.parent;
		}
		this._enabledCache = true;
		return true;
	}

	/**
	 * Invalidates the enabled cache for this entity and all its descendants.
	 * This is called when enabledSelf changes or when parent changes.
	 * Uses an iterative approach with a stack to avoid potential stack overflow for deep trees.
	 */
	private _invalidateEnabledCache() {
		const stack: Entity[] = [this];

		while (stack.length) {
			// biome-ignore lint/style/noNonNullAssertion: stack is not null
			const entity = stack.pop()!;
			entity._enabledCache = null;

			// Push all children onto the stack
			for (let i = entity._children.length - 1; i >= 0; i--) {
				stack.push(entity._children[i]);
			}
		}
	}

	/**
	 * Adds a child entity to this entity. If the child already has a parent, it will be removed from its previous parent first.
	 * @param child - The entity to add as a child.
	 */
	addChild(child: Entity) {
		this._children.push(child);
		if (child.parent) {
			child.parent.removeChild(child);
		}
		child._parent = this;
		child._invalidateEnabledCache();
	}

	/**
	 * Removes a child entity by its index in the children array. The removed child's parent will be set to `null`.
	 * @param index - The index of the child to remove.
	 */
	removeChildByIndex(index: number) {
		const child = this._children.splice(index, 1);
		child[0].setParent(null);
		child[0]._invalidateEnabledCache();
	}

	/**
	 * Removes a child entity. The removed child's parent will be set to `null`.
	 * @param child - The child entity to remove.
	 */
	removeChild(child: Entity) {
		const index = this._children.indexOf(child);
		if (index !== -1) {
			this._children.splice(index, 1);
			child.setParent(null);
			child._invalidateEnabledCache();
		}
	}

	/**
	 * Gets the number of direct child entities.
	 * @returns The number of children.
	 */
	childrenLength() {
		return this._children.length;
	}

	/**
	 * Gets a child entity by its index in the children array.
	 * @template T - The type of entity to return. Defaults to `Entity`.
	 * @param index - The index of the child to retrieve.
	 * @returns The child entity at the specified index, or `undefined` if the index is out of bounds.
	 */
	childByIdx<T extends Entity = Entity>(index: number): T {
		return this._children[index] as T;
	}

	/**
	 * Finds the first child entity that matches the given predicate.
	 * @template T - The type of entity to return. Defaults to `Entity`.
	 * @param predicate - A function that returns `true` for the child to find.
	 * @returns The first matching child entity, or `undefined` if no match is found.
	 */
	getChild<T extends Entity = Entity>(
		predicate: (child: Entity) => boolean,
	): T {
		return this._children.find(predicate) as T;
	}

	/**
	 * Gets the index of a child entity in the children array.
	 * @param child - The child entity to find the index of.
	 * @returns The index of the child, or `-1` if not found.
	 */
	indexOfChild(child: Entity) {
		return this._children.indexOf(child);
	}

	/**
	 * Gets all child entities that match the given filter function.
	 * @template T - The type of entity to return. Defaults to `Entity`.
	 * @param filter - A function that returns `true` for children to include.
	 * @returns An array of matching child entities.
	 */
	getChildren<T extends Entity = Entity>(
		filter: (child: Entity) => boolean,
	): T[] {
		return this._children.filter(filter) as T[];
	}

	/**
	 * Traverses the children of this entity and all its descendants using a depth-first approach.
	 * @template T - The type of entity to yield. Defaults to `Entity`.
	 * @param predicate - Optional predicate to filter the children. If provided and returns `true`, the child will be yielded and its descendants will be traversed. If omitted, all children are traversed.
	 * @returns A generator that yields entities in the traversal order.
	 */
	*traverseChildren<T extends Entity = Entity>(
		predicate?: (child: Entity) => boolean,
	): Generator<T> {
		const stack: Entity[] = [];

		for (let i = this._children.length - 1; i >= 0; i--) {
			stack.push(this._children[i]);
		}

		while (stack.length) {
			// biome-ignore lint/style/noNonNullAssertion: stack is not null
			const e = stack.pop()!;
			if (predicate && !predicate(e)) continue;
			yield e as T;

			const c = e._children;
			for (let i = c.length - 1; i >= 0; i--) {
				stack.push(c[i]);
			}
		}
	}

	/**
	 * Traverses the components of this entity and all its descendants using a pre-order depth-first approach.
	 * Only traverses enabled entities. Components are yielded before their entity's children.
	 * @template T - The type of component to yield. Defaults to `Component`.
	 * @param predicate - Optional predicate to filter the components. If provided and returns `true`, the component will be yielded. If omitted, all components are traversed.
	 * @returns A generator that yields components in the traversal order.
	 */
	*traverseComponents<T extends Component = Component>(
		predicate?: (component: Component) => boolean,
	): Generator<T> {
		const stack: Entity[] = [];

		// push root
		stack.push(this);

		const hasPredicate = predicate !== undefined;

		while (stack.length) {
			// biome-ignore lint/style/noNonNullAssertion: stack is not null
			const entity = stack.pop()!;

			// yield components first (pre-order)
			const components = entity._components;
			for (let i = 0; i < components.length; i++) {
				const component = components[i];
				if (!hasPredicate || predicate(component)) {
					yield component as T;
				}
			}

			// push children in reverse to preserve order
			const children = entity._children;
			for (let i = children.length - 1; i >= 0; i--) {
				const child = children[i];
				if (child.enabledSelf) {
					stack.push(child);
				}
			}
		}
	}

	/**
	 * Sets or clears the parent entity. If setting a new parent, this entity will be removed from its previous parent and added to the new one.
	 * Invalidates the enabled cache when the parent changes.
	 * @param parent - The new parent entity, or `null` to remove the parent.
	 */
	setParent(parent: Entity | null) {
		if (this._parent) {
			this._parent.removeChild(this);
		}
		this._parent = parent;
		if (parent) {
			parent._children.push(this);
		}
		// Invalidate enabled cache when parent changes
		this._invalidateEnabledCache();
	}

	/**
	 * Gets the parent entity in the hierarchy.
	 * @returns The parent entity, or `null` if this entity has no parent (i.e., it's a root entity).
	 */
	get parent() {
		return this._parent;
	}

	/**
	 * Gets the depth level of this entity in the hierarchy. Root entities have a level of 0.
	 * @returns The number of ancestors (parent entities) in the hierarchy chain.
	 */
	hierarchyLevel() {
		let level = 0;
		let current: Entity | null = this._parent;
		while (current) {
			level++;
			current = current.parent;
		}
		return level;
	}

	/**
	 * Gets the number of components attached to this entity.
	 * @returns The number of components.
	 */
	componentsLength() {
		return this._components.length;
	}

	/**
	 * Gets a component by its index in the components array.
	 * @template T - The type of component to return. Defaults to `Component`.
	 * @param index - The index of the component to retrieve.
	 * @returns The component at the specified index, or `undefined` if the index is out of bounds.
	 */
	componentByIdx<T extends Component = Component>(index: number): T {
		return this._components[index] as T;
	}

	/**
	 * Finds the first component that matches the given predicate.
	 * @template T - The type of component to return. Defaults to `Component`.
	 * @param predicate - A function that returns `true` for the component to find.
	 * @returns The first matching component, or `undefined` if no match is found.
	 */
	getComponent<T extends Component = Component>(
		predicate: (component: Component) => boolean,
	): T {
		return this._components.find(predicate) as T;
	}

	/**
	 * Finds the first component of the specified type. Uses an optimized type map for fast lookups when available.
	 *
	 * **Performance Note:** Components are only added to the internal type map for optimized lookups when they are
	 * created with `precacheTypeLookup: true`. If a component is created with `precacheTypeLookup: false` (the default),
	 * it will not be in the type map and the lookup will fall back to iterating through all components, which is slower
	 * but avoids the overhead of maintaining the map for components that are rarely looked up by type.
	 *
	 * @template T - The type of component to return.
	 * @param type - The constructor function of the component type to find.
	 * @returns The first matching component of the specified type, or `undefined` if not found.
	 *
	 * @example
	 * ```typescript
	 * class TransformComponent extends Component {}
	 * const entity = new Entity();
	 * // Component is NOT added to type map by default (precacheTypeLookup defaults to false)
	 * const transform = new TransformComponent(entity);
	 * const found = entity.getComponentByType(TransformComponent); // Slower, iterates through components
	 *
	 * // Component is added to type map for fast lookups (precacheTypeLookup: true)
	 * const render = new RenderComponent(entity, { precacheTypeLookup: true });
	 * const foundRender = entity.getComponentByType(RenderComponent); // Fast O(1) lookup
	 * ```
	 */
	getComponentByType<T extends Component>(
		// biome-ignore lint/suspicious/noExplicitAny: It's fine, we need to support any constructor
		type: new (...args: any[]) => T,
	): T | undefined {
		const direct = this._componentMap.get(type);
		if (direct) {
			return direct as T;
		}

		// No map entry, iterate to find first component
		for (const c of this._components) {
			if (c instanceof type) {
				this._componentMap.set(type, c);
				return c as T;
			}
		}
		return undefined;
	}

	/**
	 * Gets all components that match the given filter function.
	 * @template T - The type of component to return. Defaults to `Component`.
	 * @param filter - A function that returns `true` for components to include.
	 * @returns An array of matching components.
	 */
	getComponents<T extends Component = Component>(
		filter: (component: Component) => boolean,
	): T[] {
		// Writing filter manually, as this is supposedly faster than using the built in filter method or generator
		const result: T[] = [];
		const components = this._components;

		for (let i = 0, l = components.length; i < l; i++) {
			const c = components[i];
			if (filter(c)) {
				result.push(c as T);
			}
		}

		return result;
	}

	/**
	 * Gets the index of a component in the components array.
	 * @param component - The component to find the index of.
	 * @returns The index of the component, or `-1` if not found.
	 */
	indexOfComponent(component: Component) {
		return this._components.indexOf(component);
	}

	/**
	 * Ticks this entity and all its descendants, calling `onTick` on all enabled components.
	 * This should ONLY be called from the root of an Entity tree. Will traverse the full depth of the tree.
	 * Disabled entity subtrees and disabled components are skipped during traversal.
	 * @param deltaTime - The time elapsed since the last tick in milliseconds.
	 */
	protected _tick(deltaTime: number) {
		if (!this._enabledSelf) return;
		this._components.forEach((component) => {
			if (!component.enabledSelf) return;
			// biome-ignore lint/suspicious/noExplicitAny: Override protected guard
			(component as any).onTick(deltaTime);
		});
		for (const child of this.traverseChildren((child) => child.enabledSelf)) {
			child._components.forEach((component) => {
				if (!component.enabledSelf) return;
				// biome-ignore lint/suspicious/noExplicitAny: Override protected guard
				(component as any).onTick(deltaTime);
			});
		}
	}
}
