import streamDeck from "@elgato/streamdeck";

import { PlaySound } from "./actions/play-sound";
import { StopAll } from "./actions/stop-all";
import { rrrClient } from "./rrr-client";

streamDeck.logger.setLevel("trace");

streamDeck.actions.registerAction(new PlaySound());
streamDeck.actions.registerAction(new StopAll());

streamDeck.connect();

rrrClient.on("connected", () => {
	console.log("[RRR] Connected to RRR");
	rrrClient.send({ type: "get-sounds" });
});

rrrClient.on("disconnected", () => {
	console.log("[RRR] Disconnected from RRR");
});

rrrClient.on("message", (data) => {
	console.log("[RRR] Message received:", data);
});
