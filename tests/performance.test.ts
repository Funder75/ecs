import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
} from "vitest";
import Entity from "../src/entity";
import { TestComponent } from "./testComponent";

// Type declarations for Node.js globals in test environment
declare const process: {
	memoryUsage(): { heapUsed: number };
};

declare const global: {
	gc?: () => void;
};

/**
 * Performance test results model
 */
interface PerformanceResults {
	instantiation: {
		entitiesCreated: number;
		expectedEntities: number;
		timeMs: number;
		memoryUsedKB: number;
		memoryPerEntityKB: number;
	};
	enabledPropertyAccess: {
		totalAccesses: number;
		totalTimeMs: number;
		avgTimePerEntityMs: number;
		avgTimePerAccessMs: number;
	};
	componentEnableDisableEvents: {
		totalComponents: number;
		disableTimeMs: number;
		enableTimeMs: number;
		timePerComponentDisableMs: number;
		timePerComponentEnableMs: number;
		eventsFiredDisabled: number;
		eventsFiredEnabled: number;
	};
	componentTickEvent: {
		totalComponents: number;
		ticksExecuted: number;
		totalTimeMs: number;
		avgTimePerTickMs: number;
		timePerComponentPerTickMs: number;
		totalTickEventsFired: number;
	};
}

// Baseline comparison values (to be filled in later)
interface BaselineValues {
	instantiationTimeMs?: number;
	instantiationMemoryKB?: number;
	instantiationMemoryPerEntityKB?: number;
	enabledPropertyAccessTimeMs?: number;
	enabledPropertyAccessAvgTimeMs?: number;
	componentEnableDisableDisableTimeMs?: number;
	componentEnableDisableEnableTimeMs?: number;
	componentTickEventTotalTimeMs?: number;
	componentTickEventAvgTimeMs?: number;
}

// Global results storage
const performanceResults: Partial<PerformanceResults> = {};

// Baseline values (to be filled in later)
const baselineValues: BaselineValues = {
	instantiationTimeMs: 8.8,
	instantiationMemoryKB: 12410.88,
	instantiationMemoryPerEntityKB: 1.116,
	enabledPropertyAccessTimeMs: 131.2,
	enabledPropertyAccessAvgTimeMs: 0.00000118,
};

/**
 * Sets up an entity tree with a specified depth, width, and number of components per entity.
 * @param {number} depth - The number of levels in the tree (including the root).
 * @param {number} width - Number of children for each non-leaf entity.
 * @param {number} componentsPerEntity - Number of components (TestComponent) to add to each entity.
 * @returns {Entity} The root entity of the created tree.
 */
export function createEntityTree(
	depth: number,
	width: number,
	componentsPerEntity: number,
): Entity {
	function createNode(currentDepth: number, idPrefix: string): Entity {
		const entity = new Entity({ id: `${idPrefix}` });

		// Add TestComponents
		for (let i = 0; i < componentsPerEntity; i++) {
			new TestComponent(entity);
		}

		if (currentDepth < depth) {
			for (let j = 0; j < width; j++) {
				const child = createNode(currentDepth + 1, `${idPrefix}_${j}`);
				entity.addChild(child);
			}
		}

		return entity;
	}

	return createNode(1, "root");
}

/**
 * Collects all entities from a tree into an array
 */
function collectAllEntities(root: Entity): Entity[] {
	const entities: Entity[] = [];
	const stack: Entity[] = [root];

	while (stack.length > 0) {
		const entity = stack.pop();
		if (!entity) break;
		entities.push(entity);
		for (let i = 0; i < entity.childrenLength(); i++) {
			stack.push(entity.childByIdx(i));
		}
	}

	return entities;
}

/**
 * Gets current memory usage in bytes
 */
function getMemoryUsage(): number {
	const usage = process.memoryUsage();
	return usage.heapUsed;
}

/**
 * Forces garbage collection if available
 */
function forceGC(): void {
	if (global.gc) {
		global.gc();
	}
}

describe("Performance Tests - Big Entity Tree", () => {
	// Tree configuration: 5 levels deep, 10 children per node, 3 components per entity
	const DEPTH = 5;
	const WIDTH = 10;
	const COMPONENTS_PER_ENTITY = 3;

	// Calculate expected total entities (geometric series: 1 + width + width^2 + ... + width^(depth-1))
	const EXPECTED_ENTITIES = (WIDTH ** DEPTH - 1) / (WIDTH - 1);

	let root: Entity;
	let allEntities: Entity[];

	beforeEach(() => {
		forceGC();
	});

	afterEach(() => {
		root = null as unknown as Entity;
		allEntities = [];
		forceGC();
	});

	test("Instantiation: Size and Time", () => {
		const memoryBefore = getMemoryUsage();

		const startTime = performance.now();
		root = createEntityTree(DEPTH, WIDTH, COMPONENTS_PER_ENTITY);
		const endTime = performance.now();

		const memoryAfter = getMemoryUsage();
		const memoryUsed = memoryAfter - memoryBefore;

		allEntities = collectAllEntities(root);
		const actualEntityCount = allEntities.length;

		const instantiationTime = endTime - startTime;

		const memoryUsedKB = memoryUsed / 1024;
		const memoryPerEntityKB = memoryUsedKB / actualEntityCount;

		console.log(`\n=== Instantiation Performance ===`);
		console.log(`Entities created: ${actualEntityCount}`);
		console.log(`Expected entities: ${EXPECTED_ENTITIES}`);
		console.log(`Time: ${instantiationTime.toFixed(2)}ms`);
		console.log(`Memory used: ${memoryUsedKB.toFixed(2)}KB`);
		console.log(`Memory per entity: ${memoryPerEntityKB.toFixed(2)}KB`);

		// Store results
		performanceResults.instantiation = {
			entitiesCreated: actualEntityCount,
			expectedEntities: EXPECTED_ENTITIES,
			timeMs: instantiationTime,
			memoryUsedKB,
			memoryPerEntityKB,
		};

		expect(root).toBeDefined();
		expect(actualEntityCount).toBeGreaterThan(0);
		expect(instantiationTime).toBeGreaterThan(0);
	});

	test("Enabled Property Access Time", () => {
		root = createEntityTree(DEPTH, WIDTH, COMPONENTS_PER_ENTITY);
		allEntities = collectAllEntities(root);

		const iterations = 10000;
		const startTime = performance.now();

		for (let i = 0; i < iterations; i++) {
			for (const entity of allEntities) {
				// Access enabled property
				const _enabled = entity.enabled;
			}
		}

		const endTime = performance.now();
		const totalTime = endTime - startTime;
		const avgTimePerEntity = totalTime / (iterations * allEntities.length);
		const avgTimePerAccess = totalTime / (iterations * allEntities.length);

		const totalAccesses = iterations * allEntities.length;

		console.log(`\n=== Enabled Property Access Performance ===`);
		console.log(`Total accesses: ${totalAccesses}`);
		console.log(`Total time: ${totalTime.toFixed(2)}ms`);
		console.log(`Average time per entity: ${avgTimePerEntity.toFixed(4)}ms`);
		console.log(`Average time per access: ${avgTimePerAccess.toFixed(6)}ms`);

		// Store results
		performanceResults.enabledPropertyAccess = {
			totalAccesses,
			totalTimeMs: totalTime,
			avgTimePerEntityMs: avgTimePerEntity,
			avgTimePerAccessMs: avgTimePerAccess,
		};

		expect(totalTime).toBeGreaterThan(0);
	});

	test("Component Enable/Disable Events: Time Performance", () => {
		root = createEntityTree(DEPTH, WIDTH, COMPONENTS_PER_ENTITY);
		allEntities = collectAllEntities(root);

		// Collect all components
		const allComponents: Array<InstanceType<typeof TestComponent>> = [];
		for (const entity of allEntities) {
			for (let i = 0; i < entity.componentsLength(); i++) {
				allComponents.push(
					entity.componentByIdx(i) as InstanceType<typeof TestComponent>,
				);
			}
		}

		// Clear any existing calls
		for (const component of allComponents) {
			component.onEnabledChangedCalls = [];
		}

		// Test disabling root entity (should disable all components)
		const disableStartTime = performance.now();
		root.enabledSelf = false;
		const disableEndTime = performance.now();
		const disableTime = disableEndTime - disableStartTime;

		// Count disabled calls
		let disabledCount = 0;
		for (const component of allComponents) {
			for (const call of component.onEnabledChangedCalls) {
				if (!call.newValue) {
					disabledCount++;
				}
			}
		}

		const expectedDisabledEvents = allComponents.length;
		expect(disabledCount).toBe(expectedDisabledEvents);

		// Clear calls before enabling
		for (const component of allComponents) {
			component.onEnabledChangedCalls = [];
		}

		// Test enabling root entity (should enable all components)
		const enableStartTime = performance.now();
		root.enabledSelf = true;
		const enableEndTime = performance.now();
		const enableTime = enableEndTime - enableStartTime;

		// Count enabled calls
		let enabledCount = 0;
		for (const component of allComponents) {
			for (const call of component.onEnabledChangedCalls) {
				if (call.newValue) {
					enabledCount++;
				}
			}
		}

		const expectedEnabledEvents = allComponents.length;
		expect(enabledCount).toBe(expectedEnabledEvents);

		const timePerComponentDisable = disableTime / allComponents.length;
		const timePerComponentEnable = enableTime / allComponents.length;

		console.log(`\n=== Component Enable/Disable Events Performance ===`);
		console.log(`Total components: ${allComponents.length}`);
		console.log(`Disable time: ${disableTime.toFixed(2)}ms`);
		console.log(`Enable time: ${enableTime.toFixed(2)}ms`);
		console.log(
			`Time per component (disable): ${timePerComponentDisable.toFixed(6)}ms`,
		);
		console.log(
			`Time per component (enable): ${timePerComponentEnable.toFixed(6)}ms`,
		);
		console.log(`Events fired (disabled): ${disabledCount}`);
		console.log(`Events fired (enabled): ${enabledCount}`);

		// Store results
		performanceResults.componentEnableDisableEvents = {
			totalComponents: allComponents.length,
			disableTimeMs: disableTime,
			enableTimeMs: enableTime,
			timePerComponentDisableMs: timePerComponentDisable,
			timePerComponentEnableMs: timePerComponentEnable,
			eventsFiredDisabled: disabledCount,
			eventsFiredEnabled: enabledCount,
		};

		expect(disableTime).toBeGreaterThan(0);
		expect(enableTime).toBeGreaterThan(0);
	});

	test("Component Tick Event: Multiple Ticks Performance", () => {
		root = createEntityTree(DEPTH, WIDTH, COMPONENTS_PER_ENTITY);
		allEntities = collectAllEntities(root);

		// Collect all components
		const allComponents: Array<InstanceType<typeof TestComponent>> = [];
		for (const entity of allEntities) {
			for (let i = 0; i < entity.componentsLength(); i++) {
				allComponents.push(
					entity.componentByIdx(i) as InstanceType<typeof TestComponent>,
				);
			}
		}

		// Clear any existing calls
		for (const component of allComponents) {
			component.onTickCalls = [];
		}

		const numberOfTicks = 100;
		const startTime = performance.now();

		for (let i = 0; i < numberOfTicks; i++) {
			// biome-ignore lint/suspicious/noExplicitAny: suppress private guard
			(root as any)._tick(16.67); // ~60fps deltaTime
		}

		const endTime = performance.now();
		const totalTime = endTime - startTime;
		const avgTimePerTick = totalTime / numberOfTicks;

		// Count total tick calls
		let eventCount = 0;
		for (const component of allComponents) {
			eventCount += component.onTickCalls.length;
		}

		const expectedTotalTicks = numberOfTicks * allComponents.length;
		expect(eventCount).toBe(expectedTotalTicks);

		const timePerComponentPerTick = avgTimePerTick / allComponents.length;

		console.log(`\n=== Component Tick Event: Multiple Ticks Performance ===`);
		console.log(`Total components: ${allComponents.length}`);
		console.log(`Ticks executed: ${numberOfTicks}`);
		console.log(`Total time: ${totalTime.toFixed(2)}ms`);
		console.log(`Average time per tick: ${avgTimePerTick.toFixed(4)}ms`);
		console.log(
			`Time per component per tick: ${timePerComponentPerTick.toFixed(8)}ms`,
		);
		console.log(`Total tick events fired: ${eventCount}`);

		// Store results
		performanceResults.componentTickEvent = {
			totalComponents: allComponents.length,
			ticksExecuted: numberOfTicks,
			totalTimeMs: totalTime,
			avgTimePerTickMs: avgTimePerTick,
			timePerComponentPerTickMs: timePerComponentPerTick,
			totalTickEventsFired: eventCount,
		};

		expect(totalTime).toBeGreaterThan(0);
	});

	afterAll(() => {
		console.log(`\n${"=".repeat(100)}`);
		console.log("PERFORMANCE TEST RESULTS SUMMARY");
		console.log(`${"=".repeat(100)}\n`);

		// Helper function to calculate deviation percentage
		const calculateDeviation = (
			current: number,
			baseline: number | undefined,
		): string => {
			if (baseline === undefined || baseline === 0) return "-";
			const deviation = ((current - baseline) / baseline) * 100;
			return `${deviation >= 0 ? "+" : ""}${deviation.toFixed(2)}%`;
		};

		const tableData: Array<{
			Metric: string;
			Value: string;
			Baseline?: string;
			Deviation?: string;
		}> = [];

		// Instantiation Results
		if (performanceResults.instantiation) {
			const inst = performanceResults.instantiation;
			tableData.push(
				{
					Metric: "📊 Instantiation - Entities Created",
					Value: inst.entitiesCreated.toLocaleString(),
				},
				{
					Metric: "📊 Instantiation - Time (ms)",
					Value: inst.timeMs.toFixed(2),
					Baseline: baselineValues.instantiationTimeMs?.toFixed(2) || "-",
					Deviation: calculateDeviation(
						inst.timeMs,
						baselineValues.instantiationTimeMs,
					),
				},
				{
					Metric: "📊 Instantiation - Memory Used (KB)",
					Value: inst.memoryUsedKB.toFixed(2),
					Baseline: baselineValues.instantiationMemoryKB?.toFixed(2) || "-",
					Deviation: calculateDeviation(
						inst.memoryUsedKB,
						baselineValues.instantiationMemoryKB,
					),
				},
				{
					Metric: "📊 Instantiation - Memory per Entity (KB)",
					Value: inst.memoryPerEntityKB.toFixed(2),
					Baseline:
						baselineValues.instantiationMemoryPerEntityKB?.toFixed(2) || "-",
					Deviation: calculateDeviation(
						inst.memoryPerEntityKB,
						baselineValues.instantiationMemoryPerEntityKB,
					),
				},
			);
		}

		// Enabled Property Access Results
		if (performanceResults.enabledPropertyAccess) {
			const acc = performanceResults.enabledPropertyAccess;
			tableData.push(
				{
					Metric: "⚡ Property Access - Total Accesses",
					Value: acc.totalAccesses.toLocaleString(),
				},
				{
					Metric: "⚡ Property Access - Total Time (ms)",
					Value: acc.totalTimeMs.toFixed(2),
					Baseline:
						baselineValues.enabledPropertyAccessTimeMs?.toFixed(2) || "-",
					Deviation: calculateDeviation(
						acc.totalTimeMs,
						baselineValues.enabledPropertyAccessTimeMs,
					),
				},
				{
					Metric: "⚡ Property Access - Avg Time per Access (ms)",
					Value: acc.avgTimePerAccessMs.toFixed(8),
					Baseline:
						baselineValues.enabledPropertyAccessAvgTimeMs?.toFixed(8) || "-",
					Deviation: calculateDeviation(
						acc.avgTimePerAccessMs,
						baselineValues.enabledPropertyAccessAvgTimeMs,
					),
				},
			);
		}

		// Component Enable/Disable Events Results
		if (performanceResults.componentEnableDisableEvents) {
			const evt = performanceResults.componentEnableDisableEvents;
			tableData.push(
				{
					Metric: "🔄 Component Enable/Disable - Total Components",
					Value: evt.totalComponents.toLocaleString(),
				},
				{
					Metric: "🔄 Component Enable/Disable - Disable Time (ms)",
					Value: evt.disableTimeMs.toFixed(2),
					Baseline:
						baselineValues.componentEnableDisableDisableTimeMs?.toFixed(2) ||
						"-",
					Deviation: calculateDeviation(
						evt.disableTimeMs,
						baselineValues.componentEnableDisableDisableTimeMs,
					),
				},
				{
					Metric: "🔄 Component Enable/Disable - Enable Time (ms)",
					Value: evt.enableTimeMs.toFixed(2),
					Baseline:
						baselineValues.componentEnableDisableEnableTimeMs?.toFixed(2) ||
						"-",
					Deviation: calculateDeviation(
						evt.enableTimeMs,
						baselineValues.componentEnableDisableEnableTimeMs,
					),
				},
				{
					Metric:
						"🔄 Component Enable/Disable - Time per Component Disable (ms)",
					Value: evt.timePerComponentDisableMs.toFixed(6),
				},
				{
					Metric:
						"🔄 Component Enable/Disable - Time per Component Enable (ms)",
					Value: evt.timePerComponentEnableMs.toFixed(6),
				},
				{
					Metric: "🔄 Component Enable/Disable - Events Fired (Disabled)",
					Value: evt.eventsFiredDisabled.toLocaleString(),
				},
				{
					Metric: "🔄 Component Enable/Disable - Events Fired (Enabled)",
					Value: evt.eventsFiredEnabled.toLocaleString(),
				},
			);
		}

		// Component Tick Event Results
		if (performanceResults.componentTickEvent) {
			const tick = performanceResults.componentTickEvent;
			tableData.push(
				{
					Metric: "⏱️  Component Tick Event - Total Components",
					Value: tick.totalComponents.toLocaleString(),
				},
				{
					Metric: "⏱️  Component Tick Event - Ticks Executed",
					Value: tick.ticksExecuted.toLocaleString(),
				},
				{
					Metric: "⏱️  Component Tick Event - Total Time (ms)",
					Value: tick.totalTimeMs.toFixed(2),
					Baseline:
						baselineValues.componentTickEventTotalTimeMs?.toFixed(2) || "-",
					Deviation: calculateDeviation(
						tick.totalTimeMs,
						baselineValues.componentTickEventTotalTimeMs,
					),
				},
				{
					Metric: "⏱️  Component Tick Event - Avg Time per Tick (ms)",
					Value: tick.avgTimePerTickMs.toFixed(4),
					Baseline:
						baselineValues.componentTickEventAvgTimeMs?.toFixed(4) || "-",
					Deviation: calculateDeviation(
						tick.avgTimePerTickMs,
						baselineValues.componentTickEventAvgTimeMs,
					),
				},
				{
					Metric: "⏱️  Component Tick Event - Time per Component per Tick (ms)",
					Value: tick.timePerComponentPerTickMs.toFixed(8),
				},
				{
					Metric: "⏱️  Component Tick Event - Total Tick Events Fired",
					Value: tick.totalTickEventsFired.toLocaleString(),
				},
			);
		}

		console.table(tableData);
		console.log(`\n${"=".repeat(100)}\n`);
	});
});
