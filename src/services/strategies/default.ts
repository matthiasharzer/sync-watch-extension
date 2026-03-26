import type { PlayerAction } from '../../types';
import type { VideoPlayerSyncStrategy } from './strategy';

const ignore = () => {};

class DefaultVideoPlayerSyncStrategy implements VideoPlayerSyncStrategy {
	ignoredSeekActions(): PlayerAction[] {
		return ['seek'];
	}

	handleSeek(video: HTMLVideoElement, progress: number) {
		video.currentTime = progress;
	}

	handlePlay(video: HTMLVideoElement): void {
		video.play().catch(ignore);
	}

	handlePause(video: HTMLVideoElement): void {
		video.pause();
	}
}

export { DefaultVideoPlayerSyncStrategy };
