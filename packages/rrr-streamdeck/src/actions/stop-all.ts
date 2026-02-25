import streamDeck, { action, KeyDownEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";
import { rrrClient } from "../rrr-client";

type SoundItem = { key: string; displayName: string; category: string };

// stateReady is only true after we've received a sounds-list from RRR.
// This prevents the PI from briefly seeing "no folder" during the window
// between rrrClient connecting and the sounds-list response arriving.
let stateReady = false;
let folderSelected = false;

function pushState(): void {
	streamDeck.ui.sendToPropertyInspector({
		type: "soundsList",
		connected: stateReady,
		folderSelected,
		sounds: [] as SoundItem[],
	});
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

rrrClient.on("message", (data: { type: string; sounds?: SoundItem[]; folderSelected?: boolean }) => {
	// Update state variables but do NOT call pushState() here.
	// If we called pushState() from this module-level handler, it would send
	// sounds: [] to whatever PI is currently open — including the play-sound PI,
	// which would wipe its dropdown. The stop-all PI gets updates via its
	// requestSounds retry loop (onSendToPlugin / onPropertyInspectorDidAppear).
	if (data.type === "sounds-list" || data.type === "sounds-updated") {
		folderSelected = data.folderSelected !== false;
		stateReady = true;
	} else if (data.type === "folder-status") {
		folderSelected = false;
		stateReady = true;
	}
});

@action({ UUID: "com.pdog1.rum-runner-rhapsody.stopall" })
export class StopAll extends SingletonAction<Record<string, never>> {
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
