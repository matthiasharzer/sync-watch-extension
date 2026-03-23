import type { ConnectionState, RoomEvent, RoomFeed } from './api';
import { Observable, type ReadOnlyObservable } from './feed';
import type { SyncStrategy } from './strategies/strategy';

type ControllerState = 'idle' | 'connected';

class Controller {
	public feed: RoomFeed | null = null;
	private _video: HTMLVideoElement | null = null;
	private ignoreUntil = 0;
	private _state = new Observable<ControllerState>('idle');
	private strategy: SyncStrategy | null = null;

	get state(): ReadOnlyObservable<ControllerState> {
		return this._state;
	}

	private get video() {
		if (!this._video) {
			throw new Error('Video element not set');
		}
		return this._video;
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

	private handleFeed(event: RoomEvent | null) {
		if (!event) {
			return;
		}
		let delay = 150;

		switch (event.type) {
			case 'pause':
				this.strategy?.handlePause(this.video);
				break;
			case 'play':
				this.strategy?.handlePlay(this.video);
				break;
			case 'seek':
				delay = this.strategy?.handleSeek(this.video, event.progress) ?? 150;
				break;
		}
		this.ignoreNext(delay);
	}

	private onPlay() {
		if (this.isIgnored()) {
			return;
		}
		if (!this.feed) {
			return;
		}
		this.feed.setPlayState('playing');
	}

	private onPause() {
		if (this.isIgnored()) {
			return;
		}
		if (!this.feed) {
			return;
		}
		this.feed.setPlayState('paused');
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
		this.feed.setProgress(this.video.currentTime);
	}

	private handleFeedConnectionStateChange(state: ConnectionState) {
		if (state === 'closed') {
			this.feed = null;
			this._state.set('idle');
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
		this.feed.setProgress(this.video.currentTime);
		this.feed.subscribe(this.#handleFeed, false);
		this.feed.connectionState.subscribe(this.#handleFeedConnectionStateChange, true);
	}

	setVideo(video: HTMLVideoElement) {
		if (this._video) {
			this._video.removeEventListener('play', this.#onPlay);
			this._video.removeEventListener('pause', this.#onPause);
			this._video.removeEventListener('seeked', this.#onSeek);
		}

		this._video = video;

		this.video.addEventListener('play', this.#onPlay);
		this.video.addEventListener('pause', this.#onPause);
		this.video.addEventListener('seeked', this.#onSeek);
	}

	setStrategy(strategy: SyncStrategy) {
		this.strategy = strategy;
	}

	destroy() {
		if (this._video) {
			this._video.removeEventListener('play', this.#onPlay);
			this._video.removeEventListener('pause', this.#onPause);
			this._video.removeEventListener('seeked', this.#onSeek);
		}
		if (this.feed) {
			this.feed.close();
		}
	}
}

export { Controller };
