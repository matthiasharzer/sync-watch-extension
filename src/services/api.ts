import { Feed, Observable, type ReadOnlyFeed, type Subscriber, type Unsubscribe } from './feed';

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

type PlayStateMessage = Message<'play_state', { state: 'playing' | 'paused' }>;
type ProgressMessage = Message<'progress', { progress: number }>;
type RequestSyncMessage = Message<'request_sync', null>;

type SyncMessage = PlayStateMessage | ProgressMessage | RequestSyncMessage;

interface PlayEvent {
	type: 'play';
}
interface PauseEvent {
	type: 'pause';
}
interface SeekEvent {
	type: 'seek';
	progress: number;
}
type RoomEvent = PlayEvent | PauseEvent | SeekEvent;

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
				['playing', 'paused'].includes(message.data.state)
			);
		case 'progress':
			return message.data && typeof message.data.progress === 'number';
		case 'request_sync':
			return message.data === null;
		default:
			return false;
	}
};

class RoomFeed implements ReadOnlyFeed<RoomEvent | null> {
	public readonly roomId: string;
	private _feed = new Feed<RoomEvent | null>(null);
	private state: RoomState | null = null;
	private ws: WebSocket;
	private sentMessageIds: Set<string> = new Set();
	private latestTimestamp: number = 0;
	private _connectionState = new Observable<ConnectionState>('connecting');

	get connectionState(): ReadOnlyFeed<ConnectionState> {
		return this._connectionState;
	}

	constructor(roomId: string) {
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

	get latestValue(): RoomEvent | null {
		return this._feed.latestValue;
	}

	subscribe(subscriber: Subscriber<RoomEvent | null>, includeLatestValue: boolean): Unsubscribe {
		return this._feed.subscribe(subscriber, includeLatestValue);
	}

	unsubscribe(subscriber: Subscriber<RoomEvent | null>): void {
		this._feed.unsubscribe(subscriber);
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
				this._feed.publish({
					type: message.data.state === 'playing' ? 'play' : 'pause',
				});
				this.state = {
					state: message.data.state,
					progress: this.state?.progress || 0,
				};
				break;
			case 'progress':
				this._feed.publish({
					type: 'seek',
					progress: message.data.progress,
				});
				this.state = {
					state: this.state?.state || 'paused',
					progress: message.data.progress,
				};
				break;
			case 'request_sync':
				if (!this.state) {
					return;
				}
				this.sendMessage({
					type: 'play_state',
					data: {
						state: this.state.state,
						progress: this.state.progress || 0,
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
		this._feed.disconnect();
	}

	setPlayState(state: 'playing' | 'paused') {
		this.sendMessage({
			type: 'play_state',
			data: {
				state,
			},
		});
	}

	setProgress(progress: number) {
		this.sendMessage({
			type: 'progress',
			data: { progress },
		});
	}
}

export {
	type ConnectionState,
	createRoom,
	type PauseEvent,
	type PlayEvent,
	type RoomEvent,
	RoomFeed,
	type RoomState,
	type SeekEvent,
};
