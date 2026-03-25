interface VideoPlayerSyncStrategy {
	handleSeek(video: HTMLVideoElement, progress: number): number;
	handlePlay(video: HTMLVideoElement): void;
	handlePause(video: HTMLVideoElement): void;
}

export type { VideoPlayerSyncStrategy };
