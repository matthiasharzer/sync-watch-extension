import type { ConnectionState, RoomFeed, SyncMessage } from './api';
import { Observable } from './reactive';
import type { VideoPlayerSyncStrategy } from './strategies/strategy';

type ControllerState = 'idle' | 'connected';

interface RoomState {
	playingState: 'playing' | 'paused';
	progress: number;
}

class Controller {
	public feed: RoomFeed | null = null;
	private state: RoomState = {
		playingState: 'paused',
		progress: 0,
	};
	private _videoElement: HTMLVideoElement | null = null;

	private ignoreUntil = 0;
	private strategy: VideoPlayerSyncStrategy | null = null;
	private _connectionState = new Observable<ControllerState>('idle');

	get connectionState() {
		return this._connectionState;
	}

	private get video() {
		if (!this._videoElement) {
			throw new Error('Video element not set');
		}
		return this._videoElement;
	}

	#onPlay = this.onPlay.bind(this);
	#onPause = this.onPause.bind(this);
	#onSeek = this.onSeek.bind(this);
	#handleFeed = this.handleFeed.bind(this);
	#handleFeedConnectionStateChange = this.handleFeedConnectionStateChange.bind(this);
	#lastSeekTime = 0;

	private ignoreNext(delay: number) {
		this.ignoreUntil = Date.now() + delay;
	}

	private isIgnored() {
		return Date.now() < this.ignoreUntil;
	}

	private handleFeed(event: SyncMessage | null) {
		if (!event) {
			return;
		}
		let delay = 150;

		switch (event.type) {
			case 'play_state':
				if (event.data.state !== this.state.playingState) {
					if (event.data.state === 'playing') {
						this.strategy?.handlePlay(this.video);
					} else {
						this.strategy?.handlePause(this.video);
					}
				}
				if (Math.abs(event.data.progress - this.state.progress) > 0.5) {
					delay = this.strategy?.handleSeek(this.video, event.data.progress) ?? delay;
				}
				break;
			case 'request_sync':
				this.feed?.sendState(this.state.playingState, this.state.progress);
				break;
		}
		this.ignoreNext(delay);
	}

	private setPlayingState(playingState: 'playing' | 'paused') {
		this.state.playingState = playingState;
		this.feed?.sendState(playingState, this.state.progress);
	}

	private setProgress(progress: number) {
		this.state.progress = progress;
		this.feed?.sendState(this.state.playingState, progress);
	}

	private onPlay() {
		if (this.isIgnored()) {
			return;
		}
		if (!this.feed) {
			return;
		}

		// const currentDelta = Math.abs(this.video.currentTime - this.state.progress);
		// if (currentDelta > 0.5) {
		// 	this.setProgress(this.state.progress);
		// }
		this.setPlayingState('playing');
	}

	private onPause() {
		if (this.isIgnored()) {
			return;
		}
		if (!this.feed) {
			return;
		}
		this.setPlayingState('paused');
	}

	private onSeek() {
		if (this.isIgnored()) {
			return;
		}
		if (!this.feed) {
			return;
		}
		if (Math.abs(this.video.currentTime - this.#lastSeekTime) < 0.5) {
			return;
		}
		this.#lastSeekTime = this.video.currentTime;
		this.setProgress(this.video.currentTime);
	}

	private handleFeedConnectionStateChange(state: ConnectionState) {
		if (state === 'closed') {
			this.feed = null;
			this._connectionState.set('idle');
		} else if (state === 'open') {
			this._connectionState.set('connected');
		}
	}

	public get roomId() {
		return this.feed?.roomId || null;
	}

	setFeed(feed: RoomFeed) {
		if (this.feed) {
			this.feed.close();
		}
		this.feed = feed;

		this.feed.subscribe(this.#handleFeed, false);
		this.feed.connectionState.subscribe(this.#handleFeedConnectionStateChange, true);
	}

	setVideo(video: HTMLVideoElement) {
		if (this._videoElement) {
			this._videoElement.removeEventListener('play', this.#onPlay);
			this._videoElement.removeEventListener('pause', this.#onPause);
			this._videoElement.removeEventListener('seeked', this.#onSeek);
		}

		this._videoElement = video;

		this.video.addEventListener('play', this.#onPlay);
		this.video.addEventListener('pause', this.#onPause);
		this.video.addEventListener('seeked', this.#onSeek);
	}

	setStrategy(strategy: VideoPlayerSyncStrategy) {
		this.strategy = strategy;
	}

	destroy() {
		if (this._videoElement) {
			this._videoElement.removeEventListener('play', this.#onPlay);
			this._videoElement.removeEventListener('pause', this.#onPause);
			this._videoElement.removeEventListener('seeked', this.#onSeek);
		}
		if (this.feed) {
			this.feed.close();
		}
	}
}

export { Controller };
