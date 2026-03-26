import type { PlayerAction } from '../../types';

interface VideoPlayerSyncStrategy {
	ignoredSeekActions(): PlayerAction[];
	handleSeek(video: HTMLVideoElement, progress: number): Promise<void> | void;
	handlePlay(video: HTMLVideoElement): void;
	handlePause(video: HTMLVideoElement): void;
}

export type { VideoPlayerSyncStrategy };
