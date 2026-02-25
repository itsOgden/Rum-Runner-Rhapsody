import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { rrrClient } from "../rrr-client";

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
	override async onWillAppear(ev: WillAppearEvent<PlaySoundSettings>): Promise<void> {
		const { soundName, soundKey } = ev.payload.settings;
		await ev.action.setTitle(soundName || soundKey || "");
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlaySoundSettings>): Promise<void> {
		const { soundName, soundKey } = ev.payload.settings;
		await ev.action.setTitle(soundName || soundKey || "");
	}

	override onKeyDown(ev: KeyDownEvent<PlaySoundSettings>): void {
		const { soundKey } = ev.payload.settings;
		if (soundKey) {
			rrrClient.send({ type: "play-sound", key: soundKey });
		}
	}

	override onPropertyInspectorDidAppear(_ev: PropertyInspectorDidAppearEvent<PlaySoundSettings>): void {
		streamDeck.ui.sendToPropertyInspector({
			type: "soundsList",
			sounds: currentSounds,
			folderSelected,
		});
	}

	override async onSendToPlugin(ev: SendToPluginEvent<{ type: string }, PlaySoundSettings>): Promise<void> {
		if (ev.payload.type === "requestSounds") {
			await streamDeck.ui.sendToPropertyInspector({
				type: "soundsList",
				sounds: currentSounds,
				folderSelected,
			});
			const settings = await ev.action.getSettings();
			const title = settings.soundName || settings.soundKey || "";
			if (title) {
				await ev.action.setTitle(title);
				await ev.action.setSettings({

				})
			}
		}
	}
}
