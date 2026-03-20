import type { ConnectionState, RoomFeed, RoomState } from "./api";
import { Observable, type ReadOnlyObservable } from "./reactive";

type ControllerState = "idle" | "connected";

class Controller {
	public feed: RoomFeed | null = null;
	private video: HTMLVideoElement;
	private ignoreUntil = 0;
	private _state = new Observable<ControllerState>("idle");

	get state(): ReadOnlyObservable<ControllerState> {
		return this._state;
	}

	#onPlay = this.onPlay.bind(this);
	#onPause = this.onPause.bind(this);
	#onSeek = this.onSeek.bind(this);
	#handleStateChange = this.handleStateChange.bind(this);
	#handleFeedConnectionStateChange = this.handleFeedConnectionStateChange.bind(this);

	constructor(video: HTMLVideoElement) {
		this.video = video;
		this.setVideo(video);
	}

	private ignoreNext() {
		this.ignoreUntil = Date.now() + 50;
	}

	private isIgnored() {
		return Date.now() < this.ignoreUntil;
	}

	private handleStateChange(state: RoomState) {
		this.ignoreNext();
		if (state.state === "playing") {
			this.video.currentTime = state.progress;
			this.video.play().catch((error) => {
				console.error("Error playing video:", error);
			});
		} else {
			this.video.currentTime = state.progress;
			this.video.pause();
		}
	}

	private onPlay() {
		if (this.isIgnored()) {
			return;
		}
		if (!this.feed) {
			return;
		}
		this.feed.setPlayState("playing", this.video.currentTime);
	}

	private onPause() {
		if (this.isIgnored()) {
			return;
		}
		if (!this.feed) {
			return;
		}
		this.feed.setPlayState("paused", this.video.currentTime);
	}

	private onSeek() {
		if (this.isIgnored()) {
			return;
		}
		if (!this.feed) {
			return;
		}
		this.feed.setProgress(this.video.currentTime);
	}

	private handleFeedConnectionStateChange(state: ConnectionState) {
		if (state === "closed") {
			this.feed = null;
			this._state.set("idle");
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
		this.feed.subscribe(this.#handleStateChange, true);
		this.feed.connectionState.subscribe(this.#handleFeedConnectionStateChange, true);
	}

	setVideo(video: HTMLVideoElement) {
		this.video.removeEventListener("play", this.#onPlay);
		this.video.removeEventListener("pause", this.#onPause);
		this.video.removeEventListener("seeked", this.#onSeek);

		this.video = video;

		this.video.addEventListener("play", this.#onPlay);
		this.video.addEventListener("pause", this.#onPause);
		this.video.addEventListener("seeked", this.#onSeek);
	}

	destroy() {
		this.video.removeEventListener("play", this.#onPlay);
		this.video.removeEventListener("pause", this.#onPause);
		this.video.removeEventListener("seeked", this.#onSeek);
		if (this.feed) {
			this.feed.close();
		}
	}
}

export { Controller };
