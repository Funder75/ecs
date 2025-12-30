import Component from "../src/component";

export class TestComponent extends Component {
	// Track method calls for testing
	public onTickCalls: Array<{ deltaTime: number }> = [];
	public onEnabledChangedCalls: Array<{ newValue: boolean }> = [];

	protected onTick(deltaTime: number): void {
		this.onTickCalls.push({ deltaTime });
	}

	protected onEnabledChanged(newValue: boolean): void {
		this.onEnabledChangedCalls.push({ newValue });
	}
}

export class TransformComponent extends Component {
	x: number = 0;
	y: number = 0;
}

export class RenderComponent extends Component {
	color: string = "#ffffff";
}

export class PhysicsComponent extends Component {
	velocity: number = 0;
}
