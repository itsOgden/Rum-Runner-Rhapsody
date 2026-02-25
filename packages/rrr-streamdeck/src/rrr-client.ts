import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(__dirname, "../rrr-debug.log");
export const log = (msg: string) => fs.appendFileSync(logPath, new Date().toISOString() + " " + msg + "\n");

const WS_URL = "ws://localhost:57432";
const MAX_RETRIES = 10;
const BASE_DELAY_MS = 500;

class RRRClient extends EventEmitter {
	private ws: WebSocket | null = null;
	private retryCount = 0;

	constructor() {
		super();
		this.connect();
	}

	private connect(): void {
		log("Attempting connection to ws://localhost:57432");
		this.ws = new WebSocket(WS_URL);

		this.ws.on("open", () => {
			this.retryCount = 0;
			log("Connected successfully");
			this.emit("connected");
		});

		this.ws.on("message", (data: WebSocket.RawData) => {
			try {
				const parsed = JSON.parse(data.toString());
				log("Message received: " + JSON.stringify(parsed).slice(0, 100));
				this.emit("message", parsed);
			} catch {
				log("Message received: " + data.toString().slice(0, 100));
				this.emit("message", data.toString());
			}
		});

		this.ws.on("close", () => {
			this.emit("disconnected");
			this.scheduleReconnect();
		});

		this.ws.on("error", (error) => {
			log("Connection error: " + error.message);
		});
	}

	private scheduleReconnect(): void {
		if (this.retryCount >= MAX_RETRIES) return;
		const delay = BASE_DELAY_MS * Math.pow(2, this.retryCount);
		log("Disconnected, retrying in " + delay + "ms");
		this.retryCount++;
		setTimeout(() => this.connect(), delay);
	}

	send(data: object): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data));
		}
	}
}

export const rrrClient = new RRRClient();
