# Component Framework

A generic component framework, optimized for performance and simplicity.

## Overview

This framework implements an Entity-Component System (ECS) pattern that allows you to build flexible, hierarchical structures where entities can contain multiple components. The framework is designed with performance in mind, featuring efficient traversal algorithms, cached property access, and method-based architecture.

## How It Works

### Architecture

The framework consists of two main classes:

- **Entity**: A node in a hierarchical tree structure that can have children and components
- **Component**: Functionality attached to entities that can respond to lifecycle events through virtual methods

### Visual Structure

```text
Entity Tree Structure:
═══════════════════════════════════════════════════════════

                    [Root Entity]
                      ├─ Component A
                      ├─ Component B
                      └─ Component C
                            │
                    ┌───────┴───────┐
                    │               │
            [Child Entity 1]  [Child Entity 2]
              ├─ Component X    ├─ Component Y
              └─ Component Z    └─ Component W
                    │               │
              [Grandchild]     [Grandchild]
              ├─ Component      ├─ Component

═══════════════════════════════════════════════════════════

Key Concepts:
• Entities form a tree hierarchy (parent-child relationships)
• Each entity can have multiple components
• Components belong to exactly one entity
• Enabled/disabled state cascades down the tree
• Components respond to lifecycle events through virtual methods
```

### Core Features

- **Hierarchical Entity Tree**: Entities can have parent-child relationships
- **Component System**: Attach multiple components to entities for modular functionality
- **Enabled/Disabled State**: Cascading state management with efficient caching
- **Method-Based Architecture**: Components can override `onTick` and `onEnabledChanged` virtual methods
- **Efficient Traversal**: Optimized methods to traverse entities and components
- **Performance Optimized**: Cached property access, minimal allocations

## Installation

```bash
npm install @funderforge/ecs
# or
pnpm install @funderforge/ecs
# or
yarn add @funderforge/ecs
```

## Examples

### Basic Entity Creation

```typescript
import { Entity } from '@funderforge/ecs';

// Create a root entity
const root = new Entity({ id: 'root' });

// Create child entities
const child1 = new Entity({ id: 'child1' });
const child2 = new Entity({ id: 'child2' });

// Build the hierarchy
root.addChild(child1);
root.addChild(child2);

console.log(root.childrenLength()); // 2
console.log(child1.parent === root); // true
```

### Creating Components

```typescript
import { Entity, Component } from '@funderforge/ecs';

// Define a custom component
class TransformComponent extends Component {
  x: number = 0;
  y: number = 0;
  
  move(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }
}

// Create an entity and attach components
const entity = new Entity({ id: 'player' });
const transform = new TransformComponent(entity);
const renderer = new RenderComponent(entity);

console.log(entity.componentsLength()); // 2

// Access components with type safety
const transformComp = entity.getComponent<TransformComponent>(
  c => c instanceof TransformComponent
);
transformComp?.move(10, 20);
```

### Entity Hierarchy

```typescript
// Create a game scene hierarchy
const scene = new Entity({ id: 'scene' });
const player = new Entity({ id: 'player', parent: scene });
const enemy1 = new Entity({ id: 'enemy1', parent: scene });
const enemy2 = new Entity({ id: 'enemy2', parent: scene });

// Nested hierarchy
const weapon = new Entity({ id: 'weapon', parent: player });
const bullet = new Entity({ id: 'bullet', parent: weapon });

// Get hierarchy level
console.log(bullet.hierarchyLevel()); // 3 (scene -> player -> weapon -> bullet)

// Remove from hierarchy
scene.removeChild(enemy1);
console.log(enemy1.parent); // null
```

### Enabled/Disabled State

```typescript
// Create entity with initial state
const entity = new Entity({ id: 'entity', enabledSelf: true });
const child = new Entity({ id: 'child', parent: entity });

console.log(entity.enabled); // true
console.log(child.enabled); // true (inherits from parent)

// Disable parent - children are also disabled
entity.enabledSelf = false;
console.log(entity.enabled); // false
console.log(child.enabled); // false

// Re-enable
entity.enabledSelf = true;
console.log(child.enabled); // true

// Components respect entity enabled state
const component = new MyComponent(entity, { enabledSelf: true });
entity.enabledSelf = false;
console.log(component.enabled); // false (disabled because entity is disabled)
```

### Handling Tick Events

```typescript
class MovementComponent extends Component {
  velocity: number = 5;
  position: number = 0;

  // Override the onTick virtual method
  protected onTick(deltaTime: number): void {
    // Update position based on deltaTime (in milliseconds)
    this.position += this.velocity * (deltaTime / 1000);
  }
}

// Create entities and components
const root = new Entity({ id: 'root' });
const entity = new Entity({ id: 'moving-entity', parent: root });
const movement = new MovementComponent(entity);

// Tick the root entity (traverses the entire tree)
// This will call onTick on all enabled components
(root as any)._tick(16.67); // ~60fps deltaTime
```

### Handling Enabled State Changes

```typescript
class AudioComponent extends Component {
  // Override the onEnabledChanged virtual method
  protected onEnabledChanged(newValue: boolean): void {
    if (newValue) {
      console.log('Component enabled, starting audio');
      // Start audio playback
    } else {
      console.log('Component disabled, stopping audio');
      // Stop audio playback
    }
  }
}

const entity = new Entity({ id: 'audio-entity' });
const audio = new AudioComponent(entity);

// Disable the component
audio.enabledSelf = false; // Calls onEnabledChanged(false)

// Disable the entity (also calls onEnabledChanged for all components)
entity.enabledSelf = false;
```

### Destroying Components

```typescript
const entity = new Entity({ id: 'entity' });
const component = new MyComponent(entity);

// Use the component...
component.doSomething();

// Destroy the component when no longer needed
component.destroy();

// CRITICAL: After destroy(), the component is "dead" and must not be accessed
// Remove all references and never use it again
// component = null; // or let it go out of scope

// ❌ WRONG - Never do this after destroy():
// component.doSomething(); // Undefined behavior - component is dead
// console.log(component.entity); // Undefined behavior - component is dead
```

**Important**: After calling `destroy()` on a component, you must remove all references to it and never access it again. The component is permanently removed from its entity and accessing it will result in undefined behavior.

### Traversing Entities and Components

```typescript
const root = new Entity({ id: 'root' });
// ... build tree structure ...

// Traverse all children
for (const child of root.traverseChildren()) {
  console.log(`Child: ${child.id}`);
}

// Traverse children with a filter
for (const enabledChild of root.traverseChildren(child => child.enabledSelf)) {
  console.log(`Enabled child: ${enabledChild.id}`);
}

// Traverse all components in the tree
for (const component of root.traverseComponents()) {
  console.log(`Component: ${component.constructor.name}`);
}

// Traverse specific component types with type safety
for (const transform of root.traverseComponents<TransformComponent>(
  c => c instanceof TransformComponent
)) {
  console.log(`Transform at entity: ${transform.entity.id}`);
}

// Find specific entities/components with type safety
const player = root.getChild(e => e.id === 'player');
const transform = player?.getComponent<TransformComponent>(
  c => c instanceof TransformComponent
);
```

### Complete Example: Simple Game Scene

```typescript
import { Entity, Component } from '@funderforge/ecs';

// Define components
class TransformComponent extends Component {
  x: number = 0;
  y: number = 0;
  rotation: number = 0;
}

class RenderComponent extends Component {
  color: string = '#ffffff';
  
  protected onTick(): void {
    const transform = this.entity.getComponent<TransformComponent>(
      c => c instanceof TransformComponent
    );
    if (transform) {
      console.log(`Rendering at (${transform.x}, ${transform.y})`);
    }
  }
}

class PhysicsComponent extends Component {
  velocityX: number = 0;
  velocityY: number = 0;
  
  protected onTick(deltaTime: number): void {
    const transform = this.entity.getComponent<TransformComponent>(
      c => c instanceof TransformComponent
    );
    if (transform) {
      transform.x += this.velocityX * (deltaTime / 1000);
      transform.y += this.velocityY * (deltaTime / 1000);
    }
  }
}

// Create game scene
const scene = new Entity({ id: 'scene' });

// Create player entity
const player = new Entity({ id: 'player', parent: scene });
new TransformComponent(player);
new PhysicsComponent(player);
new RenderComponent(player);

// Create enemy entities
for (let i = 0; i < 5; i++) {
  const enemy = new Entity({ id: `enemy-${i}`, parent: scene });
  new TransformComponent(enemy);
  new RenderComponent(enemy);
}

// Game loop
function gameLoop() {
  const deltaTime = 16.67; // ~60fps
  (scene as any)._tick(deltaTime);
}

// Run game loop
setInterval(gameLoop, 16.67);
```

## API Reference

### Entity

#### Entity Constructor

```typescript
new Entity(preset?: {
  id?: string | number;
  enabledSelf?: boolean;
  parent?: Entity;
})
```

#### Entity Methods

- `addChild(child: Entity)`: Add a child entity
- `removeChild(child: Entity)`: Remove a child entity
- `setParent(parent: Entity | null)`: Set or clear the parent entity
- `childByIdx<T extends Entity = Entity>(index: number): T | undefined`: Get a child entity by index
- `getChild<T extends Entity = Entity>(predicate: (child: Entity) => boolean): T | undefined`: Find a child entity
- `getChildren<T extends Entity = Entity>(filter: (child: Entity) => boolean): T[]`: Get filtered children
- `traverseChildren<T extends Entity = Entity>(predicate?: (child: Entity) => boolean): Generator<T>`: Traverse all descendants
- `componentByIdx<T extends Component = Component>(index: number): T | undefined`: Get a component by index
- `getComponent<T extends Component = Component>(predicate: (component: Component) => boolean): T | undefined`: Find a component
- `getComponents<T extends Component = Component>(filter: (component: Component) => boolean): T[]`: Get filtered components
- `traverseComponents<T extends Component = Component>(predicate?: (component: Component) => boolean): Generator<T>`: Traverse all components in tree
- `hierarchyLevel()`: Get the depth level in the hierarchy

#### Entity Properties

- `id: string | number`: Unique identifier
- `enabledSelf: boolean`: Whether this entity is enabled (setter/getter)
- `enabled: boolean`: Whether this entity is enabled (considering parent state)
- `parent: Entity | null`: Parent entity reference

### Component

#### Component Constructor

```typescript
new Component(entity: Entity, preset?: {
  enabledSelf?: boolean;
  precacheTypeLookup?: boolean;
})
```

#### Component Virtual Methods

- `protected onTick(deltaTime: number): void`: Override this method to handle tick events. Called during entity update cycles.
- `protected onEnabledChanged(newValue: boolean): void`: Override this method to respond to enabled state changes.

#### Component Methods

- `destroy(): void`: Destroys this component, removing it from its entity. **After calling `destroy()`, the component is considered "dead" and must not be accessed or used in any way. Remove all references to the component and never access its properties or methods again.**

#### Component Properties

- `entity: Entity`: The entity this component belongs to
- `enabledSelf: boolean`: Whether this component is enabled (setter/getter)
- `enabled: boolean`: Whether this component is enabled (considering entity state)

## Performance

The framework is optimized for performance:

- **Cached Property Access**: The `enabled` property is cached and only recomputed when necessary
- **Efficient Traversal**: Uses stack-based traversal algorithms that minimize allocations
- **Selective Processing**: Disabled entities and components are skipped during traversal
- **Method-Based Architecture**: Direct method calls instead of event system overhead

## License

MIT
