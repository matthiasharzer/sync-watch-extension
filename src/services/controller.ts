import { log } from '../log';
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

	private ignoreUntilMax = {
		play: 0,
		pause: 0,
		seek: 0,
	};
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

	private ignoreNext(k: keyof typeof this.ignoreUntilMax, delay: number = 2000) {
		this.ignoreUntilMax[k] = Date.now() + delay;
	}

	private isIgnored(k: keyof typeof this.ignoreUntilMax) {
		if (Date.now() < this.ignoreUntilMax[k]) {
			this.ignoreUntilMax[k] = 0;
			return true;
		}
		return false;
	}

	private async handleFeed(event: SyncMessage | null) {
		if (!event) {
			return;
		}

		log.info('Received feed event:', event);

		switch (event.type) {
			case 'play_state': {
				const progressDelta = Math.abs(event.data.progress - (this.video.currentTime || 0));
				log.info('Progress delta:', progressDelta);
				if (progressDelta > 0.5) {
					const seeks = this.strategy?.ignoredSeekActions() || [];
					for (const seekAction of seeks) {
						this.ignoreNext(seekAction);
					}
					await this.strategy?.handleSeek(this.video, event.data.progress);
				}
				if (event.data.state !== this.state.playingState) {
					if (event.data.state === 'playing') {
						this.ignoreNext('play');
						this.strategy?.handlePlay(this.video);
					} else {
						this.ignoreNext('pause');
						this.strategy?.handlePause(this.video);
					}
					this.state.playingState = event.data.state;
					this.state.progress = event.data.progress;
				}
				break;
			}
			case 'request_sync':
				this.feed?.sendState(this.state.playingState, this.video.currentTime);
				break;
		}
	}

	private setPlayingState(playingState: 'playing' | 'paused') {
		this.state.playingState = playingState;
		this.state.progress = this.video.currentTime;
		this.feed?.sendState(playingState, this.video.currentTime);
	}

	private setProgress(progress: number) {
		this.state.progress = progress;
		this.feed?.sendState(this.state.playingState, progress);
	}

	private onPlay() {
		if (this.isIgnored('play')) {
			return;
		}
		if (!this.feed) {
			return;
		}

		log.info('Local play at:', this.video.currentTime);

		this.setPlayingState('playing');
	}

	private onPause() {
		if (this.isIgnored('pause')) {
			return;
		}
		if (!this.feed) {
			return;
		}
		this.setPlayingState('paused');
	}

	private onSeek() {
		if (this.isIgnored('seek')) {
			return;
		}
		if (!this.feed) {
			return;
		}
		log.info('Local seek to:', this.video.currentTime);
		if (Math.abs(this.video.currentTime - this.state.progress) < 0.5) {
			log.info('IGNORED');
			return;
		}
		log.info('ACCEPTED');
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

	initState() {
		this.state = {
			playingState: this.video.paused ? 'paused' : 'playing',
			progress: this.video.currentTime,
		};
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
