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

// stateReady is only true after we've received a sounds-list from RRR.
// This prevents the PI from briefly seeing "no folder" during the window
// between rrrClient connecting and the sounds-list response arriving.
let stateReady = false;
let currentSounds: SoundItem[] = [];
let folderSelected = false;

function pushState(): void {
	streamDeck.ui.sendToPropertyInspector({
		type: "soundsList",
		connected: stateReady,
		folderSelected,
		sounds: currentSounds,
	});
}

rrrClient.on("connected", () => {
	// Don't mark state as ready yet — wait for sounds-list to arrive.
	stateReady = false;
});

rrrClient.on("disconnected", () => {
	stateReady = false;
	currentSounds = [];
	folderSelected = false;
	pushState();
});

rrrClient.on("message", (data: { type: string; sounds?: SoundItem[]; folderSelected?: boolean }) => {
	if (data.type === "sounds-list" || data.type === "sounds-updated") {
		currentSounds = data.sounds ?? [];
		folderSelected = data.folderSelected !== false;
		stateReady = true;
		pushState();
	} else if (data.type === "folder-status") {
		currentSounds = [];
		folderSelected = false;
		stateReady = true;
		pushState();
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
		pushState();
	}

	override async onSendToPlugin(ev: SendToPluginEvent<{ type: string }, PlaySoundSettings>): Promise<void> {
		if (ev.payload.type === "requestSounds") {
			pushState();
			const settings = await ev.action.getSettings();
			const title = settings.soundName || settings.soundKey || "";
			if (title) await ev.action.setTitle(title);
		}
	}
}
