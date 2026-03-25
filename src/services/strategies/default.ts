import type { VideoPlayerSyncStrategy } from './strategy';

class DefaultVideoPlayerSyncStrategy implements VideoPlayerSyncStrategy {
	handleSeek(video: HTMLVideoElement, progress: number): number {
		video.currentTime = progress;
		return 150; // Return a delay to allow the video to seek before other actions
	}

	handlePlay(video: HTMLVideoElement): void {
		video.play();
	}

	handlePause(video: HTMLVideoElement): void {
		video.pause();
	}
}

export { DefaultVideoPlayerSyncStrategy };
