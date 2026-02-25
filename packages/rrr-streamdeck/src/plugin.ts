import streamDeck from "@elgato/streamdeck";

import { IncrementCounter } from "./actions/increment-counter";
import { rrrClient } from "./rrr-client";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel("trace");

// Register the increment action.
streamDeck.actions.registerAction(new IncrementCounter());

// Finally, connect to the Stream Deck.
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
