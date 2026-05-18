import streamDeck, { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { rrrClient } from "../rrr-client";
import { buildClipImage } from "../svg-compose";

let shadowEnabled = true;
let accentColor = "#F9B71D";

const activeClipActions = new Map<string, KeyAction<Record<string, never>>>();

async function applyClipImage(keyAction: KeyAction<Record<string, never>>): Promise<void> {
	try { await keyAction.setImage(buildClipImage(accentColor, shadowEnabled)); } catch {}
}

async function applyAllClipImages(): Promise<void> {
	for (const action of activeClipActions.values()) {
		applyClipImage(action).catch(() => {});
	}
}

async function applyTitle(keyAction: KeyAction<Record<string, never>>): Promise<void> {
	try { await keyAction.setTitle(shadowEnabled ? "" : "Disabled"); } catch {}
}

async function applyAllTitles(): Promise<void> {
	for (const action of activeClipActions.values()) {
		applyTitle(action).catch(() => {});
	}
}

rrrClient.on("disconnected", () => {
	shadowEnabled = true;
	applyAllClipImages();
	applyAllTitles();
});

rrrClient.on("message", (data: { type: string; shadowEnabled?: boolean; accentColor?: string }) => {
	if (data.type === "sounds-list" || data.type === "sounds-updated" || data.type === "folder-status") {
		let changed = false;
		if (data.shadowEnabled !== undefined && data.shadowEnabled !== shadowEnabled) {
			shadowEnabled = data.shadowEnabled;
			changed = true;
		}
		if (data.accentColor && data.accentColor !== accentColor) {
			accentColor = data.accentColor;
			streamDeck.settings.setGlobalSettings({ accentColor }).catch(() => {});
			changed = true;
		}
		if (changed) {
			applyAllClipImages();
			applyAllTitles();
		}
	}
});

@action({ UUID: "com.pdog1.rum-runner-rhapsody.saveclip" })
export class SaveClip extends SingletonAction<Record<string, never>> {
	override async onWillAppear(ev: WillAppearEvent<Record<string, never>>): Promise<void> {
		const keyAction = ev.action as KeyAction<Record<string, never>>;
		activeClipActions.set(ev.action.id, keyAction);
		await applyClipImage(keyAction).catch(() => {});
		await applyTitle(keyAction).catch(() => {});
	}

	override onWillDisappear(ev: WillDisappearEvent<Record<string, never>>): void {
		activeClipActions.delete(ev.action.id);
	}

	override onKeyDown(_ev: KeyDownEvent<Record<string, never>>): void {
		rrrClient.send({ type: "save-clip" });
	}
}
