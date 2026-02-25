import streamDeck, { action, KeyDownEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";
import { log, rrrClient } from "../rrr-client";

type PlaySoundSettings = {
	soundKey?: string;
	soundName?: string;
};

type SoundItem = {
	key: string;
	displayName: string;
	category: string;
};

let currentSounds: SoundItem[] = [];
let folderSelected = false;

rrrClient.on("message", (data: { type: string; sounds?: SoundItem[]; folderSelected?: boolean }) => {
	if (data.type === "sounds-list" || data.type === "sounds-updated") {
		currentSounds = data.sounds ?? [];
		folderSelected = data.folderSelected !== false;
	}
});

@action({ UUID: "com.pdog1.rum-runner-rhapsody.playsound" })
export class PlaySound extends SingletonAction<PlaySoundSettings> {
	override onKeyDown(ev: KeyDownEvent<PlaySoundSettings>): void {
		const { soundKey } = ev.payload.settings;
		log("[PlaySound] keyDown, soundKey: " + soundKey);
		if (soundKey) {
			const msg = { type: "play-sound", key: soundKey };
			log("[PlaySound] sending to RRR: " + JSON.stringify(msg));
			rrrClient.send(msg);
		}
	}

	override onPropertyInspectorDidAppear(_ev: PropertyInspectorDidAppearEvent<PlaySoundSettings>): void {
		streamDeck.ui.sendToPropertyInspector({
			type: "soundsList",
			sounds: currentSounds,
			folderSelected,
		});
	}

	override onSendToPlugin(ev: SendToPluginEvent<{ type: string }, PlaySoundSettings>): void {
		if (ev.payload.type === "requestSounds") {
			streamDeck.ui.sendToPropertyInspector({
				type: "soundsList",
				sounds: currentSounds,
				folderSelected,
			});
		}
	}
}
