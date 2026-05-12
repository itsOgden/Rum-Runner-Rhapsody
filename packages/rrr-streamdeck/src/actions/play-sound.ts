import streamDeck, { action, DidReceiveSettingsEvent, KeyAction, KeyDownEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { rrrClient } from "../rrr-client";
import { readFileSync } from "fs";

type PlaySoundSettings = {
	soundKey?: string;
	soundName?: string;
	soundCategory?: string;
	soundCategoryId?: string;
	showCategory?: boolean;
	useCategoryImage?: boolean;
};

type SoundItem = {
	key: string;
	displayName: string;
	category: string;
	categoryId?: string;
};

type CategoryImages = { idle?: string; playing?: string };

// stateReady is only true after we've received a sounds-list from RRR.
// This prevents the PI from briefly seeing "no folder" during the window
// between rrrClient connecting and the sounds-list response arriving.
let stateReady = false;
let currentSounds: SoundItem[] = [];
let folderSelected = false;
let buttonMode = true;
let categoryStreamDeckImages: Record<string, CategoryImages> = {};
let streamDeckDefaultImages: { idle?: string; playing?: string } = {};

// Playing state tracking — used to flip button images
const currentlyPlaying = new Set<string>();
type ActionEntry = { action: KeyAction<PlaySoundSettings>; soundKey: string; settings: PlaySoundSettings };
const activeActions = new Map<string, ActionEntry>();

function getCategoryImages(settings: PlaySoundSettings): CategoryImages | null {
	const id = settings.soundCategoryId;
	if (!id) return null;
	const entry = categoryStreamDeckImages[id];
	if (!entry?.idle) return null;
	return entry;
}

async function loadImage(imgPath: string): Promise<string> {
	const data = readFileSync(imgPath);
	const ext = imgPath.split(".").pop()?.toLowerCase();
	const mime = ext === "png" ? "image/png" : "image/jpeg";
	return `data:${mime};base64,${data.toString("base64")}`;
}

async function applyKeyImage(keyAction: KeyAction<PlaySoundSettings>, settings: PlaySoundSettings, isPlaying: boolean): Promise<void> {
	// Priority 1: per-category override
	const catImages = settings.useCategoryImage !== false ? getCategoryImages(settings) : null;
	if (catImages) {
		const imgPath = isPlaying && catImages.playing ? catImages.playing : catImages.idle!;
		try {
			await keyAction.setImage(await loadImage(imgPath));
			return;
		} catch {
			// unreadable — fall through
		}
	}
	// Priority 2: global default override
	if (streamDeckDefaultImages.idle) {
		const imgPath = isPlaying && streamDeckDefaultImages.playing ? streamDeckDefaultImages.playing : streamDeckDefaultImages.idle;
		try {
			await keyAction.setImage(await loadImage(imgPath));
			return;
		} catch {
			// unreadable — fall through
		}
	}
	// Priority 3: built-in key.png / playing.png state images
	try { await keyAction.setImage(""); } catch {}
	try { await keyAction.setState(isPlaying ? 1 : 0); } catch {}
}

function pushState(): void {
	streamDeck.ui.sendToPropertyInspector({
		type: "soundsList",
		connected: stateReady,
		folderSelected,
		sounds: currentSounds,
		buttonMode,
		categoryStreamDeckImages,
	});
}

rrrClient.on("connected", () => {
	// Don't mark state as ready yet — wait for sounds-list to arrive.
	stateReady = false;
	// Proactively request fresh state so we don't miss updates that were
	// broadcast while the connection was down.
	rrrClient.send({ type: "get-sounds" });
});

rrrClient.on("disconnected", () => {
	stateReady = false;
	currentSounds = [];
	folderSelected = false;
	categoryStreamDeckImages = {};
	pushState();
});

rrrClient.on("message", (data: { type: string; sounds?: SoundItem[]; folderSelected?: boolean; playingKeys?: string[]; buttonMode?: boolean; categoryStreamDeckImages?: Record<string, CategoryImages>; streamDeckDefaultImages?: { idle?: string; playing?: string } }) => {
	if (data.type === "sounds-list" || data.type === "sounds-updated") {
		currentSounds = data.sounds ?? [];
		folderSelected = data.folderSelected !== false;
		if (data.buttonMode !== undefined) buttonMode = data.buttonMode;
		categoryStreamDeckImages = data.categoryStreamDeckImages ?? {};
		if (data.streamDeckDefaultImages !== undefined) streamDeckDefaultImages = data.streamDeckDefaultImages;
		stateReady = true;
		pushState();
		// Refresh all active action images and titles from the updated sounds list
		for (const entry of activeActions.values()) {
			const { action, soundKey, settings } = entry;
			applyKeyImage(action, settings, soundKey ? currentlyPlaying.has(soundKey) : false).catch(() => {});
			if (soundKey) {
				const sound = currentSounds.find(s => s.key === soundKey);
				if (sound) {
					const updated = { ...settings, soundName: sound.displayName, soundCategory: sound.category };
					entry.settings = updated;
					action.setTitle(formatTitle(sound.category, sound.displayName, settings.showCategory ?? false)).catch(() => {});
					action.setSettings(updated).catch(() => {});
				}
			}
		}
	} else if (data.type === "folder-status") {
		currentSounds = [];
		folderSelected = false;
		categoryStreamDeckImages = {};
		if (data.streamDeckDefaultImages !== undefined) streamDeckDefaultImages = data.streamDeckDefaultImages;
		stateReady = true;
		pushState();
		for (const { action, soundKey, settings } of activeActions.values()) {
			applyKeyImage(action, settings, soundKey ? currentlyPlaying.has(soundKey) : false).catch(() => {});
		}
	} else if (data.type === "playing-status") {
		currentlyPlaying.clear();
		for (const key of (data.playingKeys ?? [])) currentlyPlaying.add(key);
		for (const { action, soundKey, settings } of activeActions.values()) {
			if (soundKey && currentlyPlaying.has(soundKey)) {
				applyKeyImage(action, settings, true).catch(() => {});
			} else {
				// Delay and re-check to prevent flicker on rapid successive updates
				const capturedKey = soundKey;
				const capturedAction = action;
				const capturedSettings = settings;
				setTimeout(() => {
					const isPlaying = !!(capturedKey && currentlyPlaying.has(capturedKey));
					applyKeyImage(capturedAction, capturedSettings, isPlaying).catch(() => {});
				}, 75);
			}
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
	if (!name) return catLine.trim();
	const nameLines = fillLines(name, showCategory ? 3 : 4);
	const lines = [catLine, ...nameLines].map(l => l.trim()).filter(l => l.length > 0);
	return lines.join("\n");
}

@action({ UUID: "com.pdog1.rum-runner-rhapsody.playsound" })
export class PlaySound extends SingletonAction<PlaySoundSettings> {
	override async onWillAppear(ev: WillAppearEvent<PlaySoundSettings>): Promise<void> {
		let settings = ev.payload.settings;
		// If the sounds list is already loaded, use fresh name/category from it rather than
		// stored settings — guards against stale data when sounds-list arrives before this
		// onWillAppear fires (race condition on plugin/Stream Deck startup).
		if (settings.soundKey && currentSounds.length > 0) {
			const match = currentSounds.find(s => s.key === settings.soundKey);
			if (match) {
				const updated = { ...settings, soundName: match.displayName, soundCategory: match.category };
				if (updated.soundName !== settings.soundName || updated.soundCategory !== settings.soundCategory) {
					settings = updated;
					ev.action.setSettings(settings).catch(() => {});
				}
			}
		}
		const { soundName, soundKey, soundCategory, showCategory } = settings;
		const keyAction = ev.action as KeyAction<PlaySoundSettings>;
		activeActions.set(ev.action.id, { action: keyAction, soundKey: soundKey ?? "", settings });
		await applyKeyImage(keyAction, settings, !!(soundKey && currentlyPlaying.has(soundKey))).catch(() => {});
		await ev.action.setTitle(formatTitle(soundCategory || "", soundName || soundKey || "", showCategory ?? false));
	}

	override onWillDisappear(ev: WillDisappearEvent<PlaySoundSettings>): void {
		activeActions.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlaySoundSettings>): Promise<void> {
		let settings = ev.payload.settings;
		// One-time migration: back-fill soundCategory for buttons saved before the fix.
		if (settings.soundKey && !settings.soundCategory) {
			const match = currentSounds.find(s => s.key === settings.soundKey);
			if (match?.category) {
				settings = { ...settings, soundCategory: match.category };
				ev.action.setSettings(settings).catch(() => {});
			}
		}
		const { soundName, soundKey, soundCategory, showCategory } = settings;
		const entry = activeActions.get(ev.action.id);
		if (entry) {
			entry.soundKey = soundKey ?? "";
			entry.settings = settings;
		}
		const keyAction = ev.action as KeyAction<PlaySoundSettings>;
		const isPlaying = !!(soundKey && currentlyPlaying.has(soundKey));
		// Run both independently — a failure in applyKeyImage must not prevent the title update
		await applyKeyImage(keyAction, settings, isPlaying).catch(() => {});
		await ev.action.setTitle(formatTitle(soundCategory || "", soundName || soundKey || "", showCategory ?? false));
	}

	override async onKeyDown(ev: KeyDownEvent<PlaySoundSettings>): Promise<void> {
		const settings = ev.payload.settings;
		const { soundKey } = settings;
		if (!soundKey) return;
		rrrClient.send({ type: "play-sound", key: soundKey });
		// Prevent Stream Deck's auto-toggle by immediately setting correct state.
		// The playing-status broadcast from RRR will update this properly once it arrives.
		await applyKeyImage(ev.action as KeyAction<PlaySoundSettings>, settings, currentlyPlaying.has(soundKey));
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
