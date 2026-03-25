import type { VideoPlayerSyncStrategy } from './strategy';

const ignore = () => {};

class CrunchyrollVideoPlayerSyncStrategy implements VideoPlayerSyncStrategy {
	handleSeek(video: HTMLVideoElement, progress: number): number {
		video.currentTime = progress;
		console.log('Crunchyroll seek to:', progress);

		chrome.runtime.sendMessage({ action: 'seekBitmovin', progress: progress }, response => {
			console.log('Bitmovin seek response:', response);
		});
		return 150;
	}

	handlePlay(video: HTMLVideoElement): void {
		video.play().catch(ignore);
	}

	handlePause(video: HTMLVideoElement): void {
		video.pause();
	}
}

export { CrunchyrollVideoPlayerSyncStrategy };
