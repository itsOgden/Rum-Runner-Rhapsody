import streamDeck, { action, KeyAction, KeyDownEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { rrrClient } from "../rrr-client";
import { readFileSync } from "fs";
import { buildStopImage } from "../svg-compose";

type SoundItem = { key: string; displayName: string; category: string };
type DefaultImages = { idle?: string; playing?: string; stop?: string };

// stateReady is only true after we've received a sounds-list from RRR.
// This prevents the PI from briefly seeing "no folder" during the window
// between rrrClient connecting and the sounds-list response arriving.
let stateReady = false;
let folderSelected = false;
let streamDeckDefaultImages: DefaultImages = {};
let accentColor = "#F9B71D";


const activeStopActions = new Map<string, KeyAction<Record<string, never>>>();

function pushState(): void {
	streamDeck.ui.sendToPropertyInspector({
		type: "soundsList",
		connected: stateReady,
		folderSelected,
		sounds: [] as SoundItem[],
		accentColor,
	});
}

async function loadImage(imgPath: string): Promise<string> {
	const data = readFileSync(imgPath);
	const ext = imgPath.split(".").pop()?.toLowerCase();
	const mime = ext === "png" ? "image/png" : "image/jpeg";
	return `data:${mime};base64,${data.toString("base64")}`;
}

async function applyStopImage(keyAction: KeyAction<Record<string, never>>): Promise<void> {
	if (streamDeckDefaultImages.stop) {
		try {
			await keyAction.setImage(await loadImage(streamDeckDefaultImages.stop));
			return;
		} catch {
			// unreadable — fall through to generated image
		}
	}
	try { await keyAction.setImage(buildStopImage(accentColor)); } catch {}
}

rrrClient.on("connected", () => {
	// Don't mark state as ready yet — wait for sounds-list to arrive.
	stateReady = false;
});

rrrClient.on("disconnected", () => {
	stateReady = false;
	folderSelected = false;
	pushState();
});

rrrClient.on("message", (data: { type: string; sounds?: SoundItem[]; folderSelected?: boolean; streamDeckDefaultImages?: DefaultImages; accentColor?: string }) => {
	// Update state variables but do NOT call pushState() here.
	// If we called pushState() from this module-level handler, it would send
	// sounds: [] to whatever PI is currently open — including the play-sound PI,
	// which would wipe its dropdown. The stop-all PI gets updates via its
	// requestSounds retry loop (onSendToPlugin / onPropertyInspectorDidAppear).
	if (data.type === "sounds-list" || data.type === "sounds-updated") {
		folderSelected = data.folderSelected !== false;
		if (data.streamDeckDefaultImages !== undefined) streamDeckDefaultImages = data.streamDeckDefaultImages;
		if (data.accentColor && data.accentColor !== accentColor) {
			accentColor = data.accentColor;
			streamDeck.settings.setGlobalSettings({ accentColor }).catch(() => {});
		}
		stateReady = true;
		for (const action of activeStopActions.values()) {
			applyStopImage(action).catch(() => {});
		}
	} else if (data.type === "folder-status") {
		folderSelected = false;
		if (data.streamDeckDefaultImages !== undefined) streamDeckDefaultImages = data.streamDeckDefaultImages;
		if (data.accentColor && data.accentColor !== accentColor) {
			accentColor = data.accentColor;
			streamDeck.settings.setGlobalSettings({ accentColor }).catch(() => {});
		}
		stateReady = true;
		for (const action of activeStopActions.values()) {
			applyStopImage(action).catch(() => {});
		}
	}
});

@action({ UUID: "com.pdog1.rum-runner-rhapsody.stopall" })
export class StopAll extends SingletonAction<Record<string, never>> {
	override async onWillAppear(ev: WillAppearEvent<Record<string, never>>): Promise<void> {
		const keyAction = ev.action as KeyAction<Record<string, never>>;
		activeStopActions.set(ev.action.id, keyAction);
		await applyStopImage(keyAction).catch(() => {});
	}

	override onWillDisappear(ev: WillDisappearEvent<Record<string, never>>): void {
		activeStopActions.delete(ev.action.id);
	}

	override onKeyDown(_ev: KeyDownEvent<Record<string, never>>): void {
		rrrClient.send({ type: "stop-all" });
	}

	override onPropertyInspectorDidAppear(_ev: PropertyInspectorDidAppearEvent<Record<string, never>>): void {
		pushState();
	}

	override async onSendToPlugin(ev: SendToPluginEvent<{ type: string }, Record<string, never>>): Promise<void> {
		if (ev.payload.type === "requestSounds") {
			pushState();
		}
	}
}
