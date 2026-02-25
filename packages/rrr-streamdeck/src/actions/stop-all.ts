import streamDeck, { action, KeyDownEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";
import { rrrClient } from "../rrr-client";

type SoundItem = { key: string; displayName: string; category: string };

let rrrConnected = false;
let folderSelected = false;

rrrClient.on("connected", () => {
	rrrConnected = true;
});

rrrClient.on("disconnected", () => {
	rrrConnected = false;
	folderSelected = false;
	streamDeck.ui.sendToPropertyInspector({ type: "soundsList", connected: false, folderSelected: false });
});

rrrClient.on("message", (data: { type: string; sounds?: SoundItem[]; folderSelected?: boolean }) => {
	if (data.type === "sounds-list" || data.type === "sounds-updated") {
		folderSelected = data.folderSelected !== false;
		streamDeck.ui.sendToPropertyInspector({ type: "soundsList", connected: rrrConnected, folderSelected });
	}
});

@action({ UUID: "com.pdog1.rum-runner-rhapsody.stopall" })
export class StopAll extends SingletonAction<Record<string, never>> {
	override onKeyDown(_ev: KeyDownEvent<Record<string, never>>): void {
		rrrClient.send({ type: "stop-all" });
	}

	override onPropertyInspectorDidAppear(_ev: PropertyInspectorDidAppearEvent<Record<string, never>>): void {
		streamDeck.ui.sendToPropertyInspector({ type: "soundsList", connected: rrrConnected, folderSelected });
	}

	override async onSendToPlugin(ev: SendToPluginEvent<{ type: string }, Record<string, never>>): Promise<void> {
		if (ev.payload.type === "requestSounds") {
			await streamDeck.ui.sendToPropertyInspector({ type: "soundsList", connected: rrrConnected, folderSelected });
		}
	}
}
