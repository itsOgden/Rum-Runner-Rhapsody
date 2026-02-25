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

function formatTitle(name: string, maxChars: number = 20): string {
	if (!name) return "";

	// Truncate: find last word-break boundary before maxChars
	function truncateTitle(s: string, max: number): string {
		if (s.length <= max) return s;
		const slice = s.slice(0, max);
		const breakAt = slice.search(/[ \-.,!?][^ \-.,!?]*$/);
		const cut = breakAt > 0 ? slice.slice(0, breakAt) : slice;
		return cut.replace(/[ \-.,!?]+$/, "");
	}

	const truncated = truncateTitle(name, maxChars);

	// Split into two lines at the space closest to the middle
	if (truncated.length > 10) {
		const mid = Math.floor(truncated.length / 2);
		let bestIdx = -1;
		let bestDist = Infinity;
		for (let i = 0; i < truncated.length; i++) {
			if (truncated[i] === " ") {
				const dist = Math.abs(i - mid);
				if (dist < bestDist) { bestDist = dist; bestIdx = i; }
			}
		}
		if (bestIdx !== -1) {
			return truncated.slice(0, bestIdx) + "\n" + truncated.slice(bestIdx + 1);
		}
	}

	return truncated;
}

@action({ UUID: "com.pdog1.rum-runner-rhapsody.playsound" })
export class PlaySound extends SingletonAction<PlaySoundSettings> {
	override async onWillAppear(ev: WillAppearEvent<PlaySoundSettings>): Promise<void> {
		const { soundName, soundKey } = ev.payload.settings;
		await ev.action.setTitle(formatTitle(soundName || soundKey || ""));
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlaySoundSettings>): Promise<void> {
		const { soundName, soundKey } = ev.payload.settings;
		await ev.action.setTitle(formatTitle(soundName || soundKey || ""));
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
			const name = settings.soundName || settings.soundKey || "";
			if (name) await ev.action.setTitle(formatTitle(name));
		}
	}
}
