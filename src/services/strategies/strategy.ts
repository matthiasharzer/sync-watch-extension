interface SyncStrategy {
	handleSeek(video: HTMLVideoElement, progress: number): number;
	handlePlay(video: HTMLVideoElement): void;
	handlePause(video: HTMLVideoElement): void;
}

export type { SyncStrategy };
