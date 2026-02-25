import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { rrrClient } from "../rrr-client";

@action({ UUID: "com.pdog1.rum-runner-rhapsody.stopall" })
export class StopAll extends SingletonAction<Record<string, never>> {
	override onKeyDown(_ev: KeyDownEvent<Record<string, never>>): void {
		rrrClient.send({ type: "stop-all" });
	}
}
