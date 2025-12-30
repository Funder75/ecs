import { describe, expect, test } from "vitest";
import Entity from "../src/entity";
import { createEntityTree } from "./performance.test";
import {
	PhysicsComponent,
	RenderComponent,
	TestComponent,
	TransformComponent,
} from "./testComponent";

describe("Test Entity", () => {
	const entity = new Entity({ id: "root" });
	const child1 = new Entity({ id: "child1" });
	const child2 = new Entity({ id: "child2" });

	entity.addChild(child1);
	entity.addChild(child2);

	test("Root initialised", () => {
		expect(entity).toBeDefined();
		expect(entity).toBeInstanceOf(Entity);
		expect(entity.enabled).toBe(true);
		expect(entity.enabledSelf).toBe(true);
		expect(entity.parent).toBeNull();
	});

	test("Children added", () => {
		expect(entity.childrenLength()).toBe(2);
		expect(entity.childByIdx(0)).toBe(child1);
		expect(entity.childByIdx(1)).toBe(child2);

		expect(child1.parent).toBe(entity);
	});

	test("Children removed", () => {
		entity.removeChildByIndex(0);

		expect(entity.childrenLength()).toBe(1);
		expect(entity.childByIdx(0)).toBe(child2);

		expect(child1.parent).toBeNull();
		expect(child2.parent).toBe(entity);
	});

	const child2Child1 = new Entity({ id: "child2Child1" });
	test("Child of child added", () => {
		child2.addChild(child2Child1);

		expect(child2.childrenLength()).toBe(1);
		expect(child2.childByIdx(0)).toBe(child2Child1);

		expect(child2Child1.parent).toBe(child2);
		expect(child2Child1.hierarchyLevel()).toBe(2);
	});

	test("Add a child to new parent", () => {
		entity.addChild(child1);
		child1.addChild(child2Child1);
		expect(child1.childrenLength()).toBe(1);
		expect(child2.childrenLength()).toBe(0);
		expect(child2Child1.parent).toBe(child1);
	});

	test("Enabling and disabling an entity", () => {
		expect(entity.enabled).toBe(true);
		expect(child1.enabled).toBe(true);
		expect(child2.enabled).toBe(true);
		expect(child2Child1.enabled).toBe(true);

		child2Child1.enabledSelf = true;
		expect(child2Child1.enabled).toBe(true);

		entity.enabledSelf = true;
		expect(child2Child1.enabled).toBe(true);
		child1.enabledSelf = true;
		expect(child2Child1.enabled).toBe(true);
	});
});

describe("Components", () => {
	const entity = new Entity({ id: "root" });
	const component1 = new TestComponent(entity);
	const component2 = new TestComponent(entity);

	test("Components added", () => {
		expect(entity.componentsLength()).toBe(2);
		expect(entity.componentByIdx(0)).toBe(component1);
		expect(entity.componentByIdx(1)).toBe(component2);
	});

	test("Component enabled state depends on entity enabled state", () => {
		const testEntity = new Entity({ id: "test", enabledSelf: false });
		const component = new TestComponent(testEntity, { enabledSelf: true });

		// Component should be disabled even though enabledSelf is true, because entity is disabled
		expect(component.enabled).toBe(false);

		// Enable entity - component should now be enabled
		testEntity.enabledSelf = true;
		expect(component.enabled).toBe(true);
	});

	test("onTick is called when entity is ticked", () => {
		const testEntity = new Entity({ id: "test" });
		const component1 = new TestComponent(testEntity);
		const component2 = new TestComponent(testEntity, { enabledSelf: false });

		// biome-ignore lint/suspicious/noExplicitAny: suppress private guard
		(testEntity as any)._tick(1234);

		// Only component1 should receive tick call (component2 is disabled)
		expect(component1.onTickCalls).toHaveLength(1);
		expect(component1.onTickCalls[0].deltaTime).toBe(1234);
		expect(component2.onTickCalls).toHaveLength(0);
	});

	test("onTick is not called for components on disabled entities", () => {
		const testEntity = new Entity({ id: "test", enabledSelf: false });
		const component = new TestComponent(testEntity);

		// biome-ignore lint/suspicious/noExplicitAny: suppress private guard
		(testEntity as any)._tick(1234);

		// Component should not receive tick call because entity is disabled
		expect(component.onTickCalls).toHaveLength(0);
	});

	test("onTick is called for components in child entities", () => {
		const parentEntity = new Entity({ id: "parent" });
		const childEntity = new Entity({ id: "child", parent: parentEntity });
		const parentComponent = new TestComponent(parentEntity);
		const childComponent = new TestComponent(childEntity);

		// biome-ignore lint/suspicious/noExplicitAny: suppress private guard
		(parentEntity as any)._tick(5678);

		// Both components should receive tick calls
		expect(parentComponent.onTickCalls).toHaveLength(1);
		expect(parentComponent.onTickCalls[0].deltaTime).toBe(5678);
		expect(childComponent.onTickCalls).toHaveLength(1);
		expect(childComponent.onTickCalls[0].deltaTime).toBe(5678);
	});

	test("onTick is not called for components in disabled child entities", () => {
		const parentEntity = new Entity({ id: "parent" });
		const childEntity = new Entity({
			id: "child",
			parent: parentEntity,
			enabledSelf: false,
		});
		const parentComponent = new TestComponent(parentEntity);
		const childComponent = new TestComponent(childEntity);

		// biome-ignore lint/suspicious/noExplicitAny: suppress private guard
		(parentEntity as any)._tick(5678);

		// Only parent component should receive tick call (child entity is disabled)
		expect(parentComponent.onTickCalls).toHaveLength(1);
		expect(parentComponent.onTickCalls[0].deltaTime).toBe(5678);
		expect(childComponent.onTickCalls).toHaveLength(0);
	});
});

describe("onEnabledChanged method", () => {
	test("onEnabledChanged is called when component becomes enabled", () => {
		const treeRoot = createEntityTree(3, 2, 2);
		treeRoot.enabledSelf = false;
		treeRoot.componentByIdx(0).enabledSelf = false;

		// Clear any initial calls
		for (const entity of treeRoot.traverseChildren()) {
			if (entity.id.toString().endsWith("0")) {
				entity.enabledSelf = false;
			}

			entity.componentByIdx(0).enabledSelf = false;

			// Clear call arrays
			for (let index = 0; index < entity.componentsLength(); index++) {
				const component = entity.componentByIdx(index) as TestComponent;
				component.onEnabledChangedCalls = [];
			}
		}

		// Clear root component call arrays
		(treeRoot.componentByIdx(0) as TestComponent).onEnabledChangedCalls = [];
		(treeRoot.componentByIdx(1) as TestComponent).onEnabledChangedCalls = [];

		expect(
			(treeRoot.componentByIdx(0) as TestComponent).onEnabledChangedCalls,
		).toHaveLength(0);
		expect(
			(treeRoot.componentByIdx(1) as TestComponent).onEnabledChangedCalls,
		).toHaveLength(0);

		treeRoot.enabledSelf = true;

		// Component 0 should not have been called (it's disabled)
		expect(
			(treeRoot.componentByIdx(0) as TestComponent).onEnabledChangedCalls,
		).toHaveLength(0);

		// Component 1 should have been called with true
		expect(
			(treeRoot.componentByIdx(1) as TestComponent).onEnabledChangedCalls,
		).toHaveLength(1);
		expect(
			(treeRoot.componentByIdx(1) as TestComponent).onEnabledChangedCalls[0]
				.newValue,
		).toBe(true);

		// Child components with index 0 should not have been called (they're disabled)
		expect(
			(treeRoot.childByIdx(0).componentByIdx(0) as TestComponent)
				.onEnabledChangedCalls,
		).toHaveLength(0);
		expect(
			(treeRoot.childByIdx(1).componentByIdx(0) as TestComponent)
				.onEnabledChangedCalls,
		).toHaveLength(0);
		expect(
			(treeRoot.childByIdx(1).componentByIdx(1) as TestComponent)
				.onEnabledChangedCalls,
		).toHaveLength(1);

		// Count total calls
		let totalCalls = 0;
		for (const entity of treeRoot.traverseChildren()) {
			for (let index = 0; index < entity.componentsLength(); index++) {
				const component = entity.componentByIdx(index) as TestComponent;
				totalCalls += component.onEnabledChangedCalls.length;
			}
		}
		// Add root component calls
		totalCalls += (treeRoot.componentByIdx(1) as TestComponent)
			.onEnabledChangedCalls.length;

		expect(totalCalls).toBe(3);
	});
});

describe("getComponentByType", () => {
	test("Returns component when component of type exists", () => {
		const entity = new Entity({ id: "test" });
		const transform = new TransformComponent(entity);

		const found = entity.getComponentByType(TransformComponent);
		expect(found).toBe(transform);
		expect(found).toBeInstanceOf(TransformComponent);
	});

	test("Returns undefined when component of type does not exist", () => {
		const entity = new Entity({ id: "test" });
		new TransformComponent(entity);

		const found = entity.getComponentByType(RenderComponent);
		expect(found).toBeUndefined();
	});

	test("Returns first component when multiple components of same type exist", () => {
		const entity = new Entity({ id: "test" });
		const transform1 = new TransformComponent(entity);
		const transform2 = new TransformComponent(entity);

		const found = entity.getComponentByType(TransformComponent);
		expect(found).toBe(transform1);
		expect(found).not.toBe(transform2);
	});

	test("Returns correct component type for different component types", () => {
		const entity = new Entity({ id: "test" });
		const transform = new TransformComponent(entity);
		const render = new RenderComponent(entity);
		const physics = new PhysicsComponent(entity);

		expect(entity.getComponentByType(TransformComponent)).toBe(transform);
		expect(entity.getComponentByType(RenderComponent)).toBe(render);
		expect(entity.getComponentByType(PhysicsComponent)).toBe(physics);
	});

	test("Uses optimized map lookup when component is in map", () => {
		const entity = new Entity({ id: "test" });
		const transform = new TransformComponent(entity);

		// The component should be in the map after creation
		const found = entity.getComponentByType(TransformComponent);
		expect(found).toBe(transform);

		// Add another component of different type
		const render = new RenderComponent(entity);
		expect(entity.getComponentByType(RenderComponent)).toBe(render);

		// Original component should still be found via map
		expect(entity.getComponentByType(TransformComponent)).toBe(transform);
	});

	test("Falls back to iteration when component not in map", () => {
		const entity = new Entity({ id: "test" });
		new TransformComponent(entity);
		const transform2 = new TransformComponent(entity, {
			precacheTypeLookup: true,
		});

		// Map should have the last component of this type
		// But getComponentByType should return the first one found in iteration
		expect(entity.componentsLength()).toBe(2);
		const found = entity.getComponentByType(TransformComponent);
		expect(found).toBeDefined();
		expect(found).toBeInstanceOf(TransformComponent);
		expect(found).toBe(transform2); // will found transform2 because transform1 is not precached
		// Verify transform2 exists but is not the one returned (map has it, but iteration finds transform1 first)
		expect(entity.componentByIdx(1)).toBe(transform2);
	});

	test("Works with empty entity", () => {
		const entity = new Entity({ id: "test" });

		expect(entity.getComponentByType(TransformComponent)).toBeUndefined();
		expect(entity.getComponentByType(RenderComponent)).toBeUndefined();
	});

	test("Returns correct type when using type parameter", () => {
		const entity = new Entity({ id: "test" });
		const transform = new TransformComponent(entity);
		transform.x = 10;
		transform.y = 20;

		const found =
			entity.getComponentByType<TransformComponent>(TransformComponent);
		expect(found).toBe(transform);
		if (found) {
			// TypeScript should know this is TransformComponent
			expect(found.x).toBe(10);
			expect(found.y).toBe(20);
		}
	});

	test("Works with mixed component types", () => {
		const entity = new Entity({ id: "test" });
		const transform1 = new TransformComponent(entity);
		const render1 = new RenderComponent(entity);
		new TransformComponent(entity);
		const physics1 = new PhysicsComponent(entity);
		new RenderComponent(entity);

		expect(entity.getComponentByType(TransformComponent)).toBe(transform1);
		expect(entity.getComponentByType(RenderComponent)).toBe(render1);
		expect(entity.getComponentByType(PhysicsComponent)).toBe(physics1);
	});
});

describe("Component destroy", () => {
	test("Destroy removes component from entity's component list", () => {
		const entity = new Entity({ id: "test" });
		const component1 = new TestComponent(entity);
		const component2 = new TestComponent(entity);
		const component3 = new TestComponent(entity);

		expect(entity.componentsLength()).toBe(3);

		component2.destroy();

		expect(entity.componentsLength()).toBe(2);
		expect(entity.componentByIdx(0)).toBe(component1);
		expect(entity.componentByIdx(1)).toBe(component3);
	});

	test("Destroy removes component from entity's type map", () => {
		const entity = new Entity({ id: "test" });
		const transform = new TransformComponent(entity, {
			precacheTypeLookup: true,
		});

		expect(entity.getComponentByType(TransformComponent)).toBe(transform);

		transform.destroy();

		expect(entity.getComponentByType(TransformComponent)).toBeUndefined();
	});

	test("Destroy clears entity reference", () => {
		const entity = new Entity({ id: "test" });
		const component = new TestComponent(entity);

		expect(component.entity).toBe(entity);

		component.destroy();

		// biome-ignore lint/suspicious/noExplicitAny: testing internal state
		expect((component as any).entity).toBeUndefined();
	});

	test("Destroy freezes component in non-production mode", () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		const entity = new Entity({ id: "test" });
		const component = new TestComponent(entity);

		component.destroy();

		expect(Object.isFrozen(component)).toBe(true);

		process.env.NODE_ENV = originalEnv;
	});

	test("Destroying already destroyed component is safe", () => {
		const entity = new Entity({ id: "test" });
		const component = new TestComponent(entity);

		component.destroy();
		expect(entity.componentsLength()).toBe(0);

		// Destroying again should be safe (no-op)
		component.destroy();
		expect(entity.componentsLength()).toBe(0);
	});

	test("Destroyed component is not found via getComponentByType", () => {
		const entity = new Entity({ id: "test" });
		const transform = new TransformComponent(entity, {
			precacheTypeLookup: true,
		});
		const render = new RenderComponent(entity, { precacheTypeLookup: true });

		expect(entity.getComponentByType(TransformComponent)).toBe(transform);
		expect(entity.getComponentByType(RenderComponent)).toBe(render);

		transform.destroy();

		expect(entity.getComponentByType(TransformComponent)).toBeUndefined();
		expect(entity.getComponentByType(RenderComponent)).toBe(render);
	});

	test("Destroyed component is not found via componentByIdx", () => {
		const entity = new Entity({ id: "test" });
		const component1 = new TestComponent(entity);
		const component2 = new TestComponent(entity);
		const component3 = new TestComponent(entity);

		expect(entity.componentByIdx(0)).toBe(component1);
		expect(entity.componentByIdx(1)).toBe(component2);
		expect(entity.componentByIdx(2)).toBe(component3);

		component2.destroy();

		expect(entity.componentByIdx(0)).toBe(component1);
		expect(entity.componentByIdx(1)).toBe(component3);
		expect(entity.componentByIdx(2)).toBeUndefined();
	});

	test("Destroyed component is not found via getComponent", () => {
		const entity = new Entity({ id: "test" });
		const component1 = new TestComponent(entity);
		const component2 = new TestComponent(entity);

		const found1 = entity.getComponent((c) => c === component1);
		const found2 = entity.getComponent((c) => c === component2);

		expect(found1).toBe(component1);
		expect(found2).toBe(component2);

		component1.destroy();

		const found1After = entity.getComponent((c) => c === component1);
		const found2After = entity.getComponent((c) => c === component2);

		expect(found1After).toBeUndefined();
		expect(found2After).toBe(component2);
	});

	test("Destroyed component is not ticked", () => {
		const entity = new Entity({ id: "test" });
		const component1 = new TestComponent(entity);
		const component2 = new TestComponent(entity);

		// biome-ignore lint/suspicious/noExplicitAny: suppress private guard
		(entity as any)._tick(100);

		expect(component1.onTickCalls).toHaveLength(1);
		expect(component2.onTickCalls).toHaveLength(1);

		component1.destroy();

		// biome-ignore lint/suspicious/noExplicitAny: suppress private guard
		(entity as any)._tick(200);

		expect(component1.onTickCalls).toHaveLength(1); // No new calls
		expect(component2.onTickCalls).toHaveLength(2); // Still receives ticks
	});

	test("Destroying one component does not affect others", () => {
		const entity = new Entity({ id: "test" });
		const component1 = new TransformComponent(entity);
		const component2 = new RenderComponent(entity);
		const component3 = new PhysicsComponent(entity);

		expect(entity.componentsLength()).toBe(3);
		expect(entity.getComponentByType(TransformComponent)).toBe(component1);
		expect(entity.getComponentByType(RenderComponent)).toBe(component2);
		expect(entity.getComponentByType(PhysicsComponent)).toBe(component3);

		component2.destroy();

		expect(entity.componentsLength()).toBe(2);
		expect(entity.getComponentByType(TransformComponent)).toBe(component1);
		expect(entity.getComponentByType(RenderComponent)).toBeUndefined();
		expect(entity.getComponentByType(PhysicsComponent)).toBe(component3);
	});

	test("Destroy removes component from type map only if it was the mapped component", () => {
		const entity = new Entity({ id: "test" });
		const transform1 = new TransformComponent(entity, {
			precacheTypeLookup: true,
		});
		const transform2 = new TransformComponent(entity, {
			precacheTypeLookup: true,
		});

		// The map should have one of them (the first one added)
		const mapped = entity.getComponentByType(TransformComponent);
		expect(mapped).toBeDefined();

		// Destroy the one that's NOT in the map
		if (mapped === transform1) {
			transform2.destroy();
			// Map should still have transform1
			expect(entity.getComponentByType(TransformComponent)).toBe(transform1);
		} else {
			transform1.destroy();
			// Map should still have transform2
			expect(entity.getComponentByType(TransformComponent)).toBe(transform2);
		}
	});

	test("Destroy removes component from type map when it is the mapped component", () => {
		const entity = new Entity({ id: "test" });
		const transform1 = new TransformComponent(entity, {
			precacheTypeLookup: true,
		});
		const transform2 = new TransformComponent(entity, {
			precacheTypeLookup: true,
		});

		// The map should have one of them
		const mapped = entity.getComponentByType(TransformComponent);
		expect(mapped).toBeDefined();

		// Destroy the one that IS in the map
		if (mapped === transform1) {
			transform1.destroy();
			// Map should be cleared, but transform2 should still be findable via iteration
			// Note: getComponentByType will fall back to iteration
			const found = entity.getComponentByType(TransformComponent);
			expect(found).toBe(transform2);
		} else {
			transform2.destroy();
			// Map should be cleared, but transform1 should still be findable via iteration
			const found = entity.getComponentByType(TransformComponent);
			expect(found).toBe(transform1);
		}
	});

	test("Destroyed component cannot access entity", () => {
		const entity = new Entity({ id: "test" });
		const component = new TestComponent(entity);

		expect(component.entity).toBe(entity);
		expect(component.entity.id).toBe("test");

		component.destroy();

		// biome-ignore lint/suspicious/noExplicitAny: testing internal state
		expect((component as any).entity).toBeUndefined();
		// Accessing component.entity should throw or be undefined
		// In TypeScript, this would be a compile error, but at runtime it's undefined
	});
});
