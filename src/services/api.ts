import { Observable, type ReadOnlyObservable } from './reactive';

const API_ENDPOINT = 'sync-watch.taptwice.dev/api/v1';
const WS_ENDPOINT = `wss://${API_ENDPOINT}`;
const HTTP_ENDPOINT = `https://${API_ENDPOINT}`;

type ConnectionState = 'connecting' | 'open' | 'closed';

interface ResponseRoom {
	id: string;
}

interface CreateRoomResponse {
	room: ResponseRoom;
}

interface RoomState {
	state: 'playing' | 'paused';
	progress: number;
}

interface Message<TMessage, TData = null> {
	timestamp: number;
	type: TMessage;
	id: string;
	data: TData;
}

type PlayStateMessage = Message<'play_state', { state: 'playing' | 'paused'; progress: number }>;
type ProgressMessage = Message<'progress', { progress: number }>;
type RequestSyncMessage = Message<'request_sync', null>;

type SyncMessage = PlayStateMessage | ProgressMessage | RequestSyncMessage;

const createRoom = async (): Promise<string> => {
	try {
		const response = await fetch(`${HTTP_ENDPOINT}/create-room`, {
			method: 'POST',
		});
		const data = (await response.json()) as CreateRoomResponse;
		return data.room.id;
	} catch (error) {
		console.error('Error creating room:', error);
	}
	return '';
};

// biome-ignore lint/suspicious/noExplicitAny: This is a simple type guard, no need for generics here.
const validateMessage = (message: any): message is SyncMessage => {
	if (typeof message !== 'object' || message === null) return false;
	if (typeof message.id !== 'string') return false;
	if (typeof message.timestamp !== 'number') return false;
	if (typeof message.type !== 'string') return false;

	switch (message.type) {
		case 'play_state':
			return (
				message.data &&
				typeof message.data.state === 'string' &&
				(message.data.state === 'playing' || message.data.state === 'paused') &&
				typeof message.data.progress === 'number'
			);
		case 'progress':
			return message.data && typeof message.data.progress === 'number';
		case 'request_sync':
			return message.data === null;
		default:
			return false;
	}
};

class RoomFeed extends Observable<RoomState> {
	public readonly roomId: string;
	private ws: WebSocket;
	private sentMessageIds: Set<string> = new Set();
	private latestTimestamp: number = 0;
	private _connectionState = new Observable<ConnectionState>('connecting');

	get connectionState(): ReadOnlyObservable<ConnectionState> {
		return this._connectionState;
	}

	constructor(roomId: string) {
		super({ state: 'paused', progress: 0 });

		this.roomId = roomId;
		this.ws = new WebSocket(`${WS_ENDPOINT}/subscribe?roomId=${roomId}`);
		this.ws.onopen = () => {
			this._connectionState.set('open');
			this.requestSync();
		};
		this.ws.onclose = () => {
			this._connectionState.set('closed');
		};
		this.ws.onmessage = this.onmessage.bind(this);
	}

	private generateId(): string {
		return Math.random().toString(36).substr(2, 9);
	}

	private sendMessage(message: Omit<SyncMessage, 'id' | 'timestamp'>) {
		if (this.ws.readyState !== WebSocket.OPEN) {
			console.warn('WebSocket is not open. Cannot send message:', message);
			return;
		}
		const messageId = this.generateId();
		this.sentMessageIds.add(messageId);
		this.ws.send(JSON.stringify({ ...message, id: messageId, timestamp: Date.now() }));
	}

	private parseMessage(data: string): SyncMessage | null {
		try {
			const message = JSON.parse(data);
			if (validateMessage(message)) {
				return message;
			} else {
				console.warn('Received invalid message:', message);
				return null;
			}
		} catch (error) {
			console.error('Error parsing message:', error);
			return null;
		}
	}

	private onmessage(event: MessageEvent) {
		const data = this.parseMessage(event.data);
		if (!data) return;
		if (!validateMessage(data)) {
			console.warn('Received invalid message:', data);
			return;
		}
		if (this.sentMessageIds.has(data.id)) {
			this.sentMessageIds.delete(data.id);
			return; // Ignore messages that we sent
		}

		if (data.timestamp < this.latestTimestamp) {
			console.warn('Received out-of-order message:', data);
			return;
		}
		this.latestTimestamp = data.timestamp;

		this.handleMessage(data);
	}

	private handleMessage(message: SyncMessage) {
		switch (message.type) {
			case 'play_state':
				this.set({
					state: message.data.state,
					progress: message.data.progress,
				});
				break;
			case 'progress':
				this.set({
					state: this.value.state,
					progress: message.data.progress,
				});
				break;
			case 'request_sync':
				this.sendMessage({
					type: 'play_state',
					data: {
						state: this.value.state,
						progress: this.value.progress || 0,
					},
				});
				break;
		}
	}

	requestSync() {
		this.sendMessage({
			type: 'request_sync',
			data: null,
		});
	}

	close() {
		this.ws.close();
		this.disconnect();
	}

	setPlayState(state: 'playing' | 'paused', progress: number) {
		this.set({
			state,
			progress,
		});
		this.sendMessage({
			type: 'play_state',
			data: this.value,
		});
	}

	setProgress(progress: number) {
		if (this.value) {
			this.set({
				...this.value,
				progress,
			});
			this.sendMessage({
				type: 'progress',
				data: { progress },
			});
		}
	}
}

export { createRoom, RoomFeed, type RoomState, type ConnectionState };
