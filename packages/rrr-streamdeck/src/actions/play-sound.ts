import streamDeck, { action, DidReceiveSettingsEvent, KeyAction, KeyDownEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { rrrClient } from "../rrr-client";

type PlaySoundSettings = {
	soundKey?: string;
	soundName?: string;
	soundCategory?: string;
	showCategory?: boolean;
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

// Playing state tracking — used to flip button images via setState()
const currentlyPlaying = new Set<string>();
type ActionEntry = { action: KeyAction<PlaySoundSettings>; soundKey: string };
const activeActions = new Map<string, ActionEntry>();

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

rrrClient.on("message", (data: { type: string; sounds?: SoundItem[]; folderSelected?: boolean; playingKeys?: string[] }) => {
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
	} else if (data.type === "playing-status") {
		currentlyPlaying.clear();
		for (const key of (data.playingKeys ?? [])) currentlyPlaying.add(key);
		for (const { action, soundKey } of activeActions.values()) {
			action.setState(soundKey && currentlyPlaying.has(soundKey) ? 1 : 0).catch(() => {});
		}
	}
});

const TITLE_MAX = 10;

// Clip a string at the last word-break boundary before `max` characters.
function truncate(s: string, max: number = TITLE_MAX): string {
	if (s.length <= max) return s;
	const slice = s.slice(0, max);
	const breakAt = slice.search(/[ \-.,!?][^ \-.,!?]*$/);
	const cut = breakAt > 0 ? slice.slice(0, breakAt) : slice;
	return cut.replace(/[ \-.,!?]+$/, "");
}

const LINE_WIDTH = 10;

// Greedily pack words into lines, each at most LINE_WIDTH chars wide.
// A single word longer than LINE_WIDTH is hard-truncated.
function fillLines(name: string, maxLines: number): string[] {
	const words = name.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const w = word.length > LINE_WIDTH ? word.slice(0, LINE_WIDTH) : word;
		if (!current) {
			current = w;
		} else if ((current + " " + w).length <= LINE_WIDTH) {
			current += " " + w;
		} else {
			lines.push(current);
			if (lines.length >= maxLines) return lines;
			current = w;
		}
	}
	if (current && lines.length < maxLines) lines.push(current);
	return lines;
}

// Format a button title.
// showCategory=true:  category on line 1, name greedy-filled across up to 3 more lines.
// showCategory=false: no category, name greedy-filled across up to 4 lines.
function formatTitle(category: string, name: string, showCategory: boolean = false): string {
	const catLine = showCategory ? truncate(category) : "";
	if (!name) return catLine;
	const nameLines = fillLines(name, showCategory ? 3 : 4);
	return [catLine, ...nameLines].filter(Boolean).join("\n");
}

@action({ UUID: "com.pdog1.rum-runner-rhapsody.playsound" })
export class PlaySound extends SingletonAction<PlaySoundSettings> {
	override async onWillAppear(ev: WillAppearEvent<PlaySoundSettings>): Promise<void> {
		const { soundName, soundKey, soundCategory, showCategory } = ev.payload.settings;
		const keyAction = ev.action as KeyAction<PlaySoundSettings>;
		activeActions.set(ev.action.id, { action: keyAction, soundKey: soundKey ?? "" });
		await keyAction.setState(soundKey && currentlyPlaying.has(soundKey) ? 1 : 0);
		await ev.action.setTitle(formatTitle(soundCategory || "", soundName || soundKey || "", showCategory ?? false));
	}

	override onWillDisappear(ev: WillDisappearEvent<PlaySoundSettings>): void {
		activeActions.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlaySoundSettings>): Promise<void> {
		const { soundName, soundKey, soundCategory, showCategory } = ev.payload.settings;
		const entry = activeActions.get(ev.action.id);
		if (entry) entry.soundKey = soundKey ?? "";
		await ev.action.setTitle(formatTitle(soundCategory || "", soundName || soundKey || "", showCategory ?? false));
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
			if (name) await ev.action.setTitle(formatTitle(settings.soundCategory || "", name, settings.showCategory ?? false));
		}
	}
}
