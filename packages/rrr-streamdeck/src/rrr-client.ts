import { EventEmitter } from "events";
import WebSocket from "ws";

const WS_URL = "ws://localhost:57432";
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 5000;

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
		const delay = Math.min(BASE_DELAY_MS * Math.pow(2, this.retryCount), MAX_DELAY_MS);
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
