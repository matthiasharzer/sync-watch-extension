import type { VideoPlayerSyncStrategy } from './strategy';

class CrunchyrollVideoPlayerSyncStrategy implements VideoPlayerSyncStrategy {
	private _forwardButton: HTMLButtonElement | null = null;
	private _backwardButton: HTMLButtonElement | null = null;

	get forwardButton() {
		if (!this._forwardButton) {
			this._forwardButton = document.querySelector('button[data-testid="jump-forward-button"]');
		}
		return this._forwardButton;
	}

	get backwardButton() {
		if (!this._backwardButton) {
			this._backwardButton = document.querySelector('button[data-testid="jump-backward-button"]');
		}
		return this._backwardButton;
	}

	handleSeek(video: HTMLVideoElement, progress: number): number {
		video.currentTime = progress;

		// const forwardButton = this.forwardButton;
		// const backwardButton = this.backwardButton;

		// if (!forwardButton || !backwardButton) {
		// 	console.warn('Forward or backward button not found, skipping workaround clicks');
		// 	return 100;
		// }

		// setTimeout(() => {
		// 	if (forwardButton && backwardButton) {
		// 		forwardButton.click();
		// 		setTimeout(() => {
		// 			backwardButton.click();
		// 		}, 10);
		// 	}
		// }, 150);
		return 230;
	}

	handlePlay(video: HTMLVideoElement): void {
		video.play();
	}

	handlePause(video: HTMLVideoElement): void {
		video.pause();
	}
}

export { CrunchyrollVideoPlayerSyncStrategy };
