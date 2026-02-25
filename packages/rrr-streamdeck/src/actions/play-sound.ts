import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { rrrClient } from "../rrr-client";

type PlaySoundSettings = {
	soundKey?: string;
	soundName?: string;
	soundCategory?: string;
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

const TITLE_MAX = 12;

// Clip a string at the last word-break boundary before `max` characters.
function truncate(s: string, max: number = TITLE_MAX): string {
	if (s.length <= max) return s;
	const slice = s.slice(0, max);
	const breakAt = slice.search(/[ \-.,!?][^ \-.,!?]*$/);
	const cut = breakAt > 0 ? slice.slice(0, breakAt) : slice;
	return cut.replace(/[ \-.,!?]+$/, "");
}

// Find the index of the space in `s` closest to `target`, optionally skipping one index.
function nearestSpace(s: string, target: number, skip = -1): number {
	let best = -1;
	let bestDist = Infinity;
	for (let i = 0; i < s.length; i++) {
		if (s[i] === " " && i !== skip) {
			const dist = Math.abs(i - target);
			if (dist < bestDist) { bestDist = dist; best = i; }
		}
	}
	return best;
}

// Format a button title: category on line 1, sound name split across up to 3 more lines.
function formatTitle(category: string, name: string): string {
	const catLine = truncate(category);

	// Name fits on one line — no splitting needed
	if (!name || name.length <= TITLE_MAX) {
		return [catLine, name].filter(Boolean).join("\n");
	}

	// Find split points nearest to 1/3 and 2/3 of the name string
	const split1 = nearestSpace(name, Math.floor(name.length / 3));
	const split2 = nearestSpace(name, Math.floor(2 * name.length / 3), split1);

	let nameLines: string[];
	if (split1 === -1) {
		// No spaces — hard truncate to one line
		nameLines = [truncate(name)];
	} else if (split2 === -1) {
		// Only one split point
		nameLines = [name.slice(0, split1), name.slice(split1 + 1)].map(c => truncate(c));
	} else {
		// Two split points — sort so chunks are in order
		const [s1, s2] = [split1, split2].sort((a, b) => a - b);
		nameLines = [name.slice(0, s1), name.slice(s1 + 1, s2), name.slice(s2 + 1)].map(c => truncate(c));
	}

	return [catLine, ...nameLines].filter(Boolean).join("\n");
}

@action({ UUID: "com.pdog1.rum-runner-rhapsody.playsound" })
export class PlaySound extends SingletonAction<PlaySoundSettings> {
	override async onWillAppear(ev: WillAppearEvent<PlaySoundSettings>): Promise<void> {
		const { soundName, soundKey, soundCategory } = ev.payload.settings;
		await ev.action.setTitle(formatTitle(soundCategory || "", soundName || soundKey || ""));
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlaySoundSettings>): Promise<void> {
		const { soundName, soundKey, soundCategory } = ev.payload.settings;
		await ev.action.setTitle(formatTitle(soundCategory || "", soundName || soundKey || ""));
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
			if (name) await ev.action.setTitle(formatTitle(settings.soundCategory || "", name));
		}
	}
}
