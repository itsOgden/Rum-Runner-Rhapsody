import { EventEmitter } from "events";
import WebSocket from "ws";

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
		this.ws = new WebSocket(WS_URL);

		this.ws.on("open", () => {
			this.retryCount = 0;
			this.emit("connected");
		});

		this.ws.on("message", (data: WebSocket.RawData) => {
			try {
				const parsed = JSON.parse(data.toString());
				this.emit("message", parsed);
			} catch {
				this.emit("message", data.toString());
			}
		});

		this.ws.on("close", () => {
			this.emit("disconnected");
			this.scheduleReconnect();
		});

		this.ws.on("error", () => {
			// error event is always followed by close; handled there
		});
	}

	private scheduleReconnect(): void {
		if (this.retryCount >= MAX_RETRIES) return;
		const delay = BASE_DELAY_MS * Math.pow(2, this.retryCount);
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
