import { Port } from '../../ports';
import type { PlayerAction } from '../../types';
import type { VideoPlayerSyncStrategy } from './strategy';

const ignore = () => {};

const backgroundPort = chrome.runtime.connect({ name: Port.BackgroundToContent.Name });

class BitmovinVideoPlayerSyncStrategy implements VideoPlayerSyncStrategy {
	ignoredSeekActions(): PlayerAction[] {
		return ['seek', 'pause'];
	}

	async handleSeek(video: HTMLVideoElement, progress: number): Promise<void> {
		return new Promise(resolve => {
			backgroundPort.postMessage({
				action: Port.BackgroundToContent.Messages.SeekBitmovin,
				progress,
			});
			const timeoutId = setTimeout(() => {
				console.warn('Seek Bitmovin response timeout, falling back to default seek');
				resolve();
			}, 2000); // 2 second timeout for response

			backgroundPort.onMessage.addListener(message => {
				if (message.action === Port.BackgroundToContent.Messages.SeekBitmovinResponse) {
					clearTimeout(timeoutId);
					console.log('Received seekBitmovinResponse:', message);
					if (!message.success) {
						// Fallback to default seeking if Bitmovin seek fails
						video.currentTime = progress;
					}
					resolve();
				}
			});
		});
	}

	handlePlay(video: HTMLVideoElement): void {
		video.play().catch(ignore);
	}

	handlePause(video: HTMLVideoElement): void {
		video.pause();
	}
}

export { BitmovinVideoPlayerSyncStrategy };
