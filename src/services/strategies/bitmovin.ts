import { log } from '../../log';
import { Port } from '../../ports';
import type { PlayerAction } from '../../types';
import type { VideoPlayerSyncStrategy } from './strategy';

const ignore = () => {};

class BitmovinVideoPlayerSyncStrategy implements VideoPlayerSyncStrategy {
	private _backgroundPort: chrome.runtime.Port | null = null;

	get backgroundPort(): chrome.runtime.Port {
		if (this._backgroundPort) {
			return this._backgroundPort;
		}

		this._backgroundPort = chrome.runtime.connect({ name: Port.BackgroundToContent.Name });
		this._backgroundPort.onDisconnect.addListener(() => {
			log.warn('Background port disconnected, resetting connection');
			this._backgroundPort = null;
		});
		return this._backgroundPort;
	}

	ignoredSeekActions(): PlayerAction[] {
		return ['seek', 'pause'];
	}

	async handleSeek(video: HTMLVideoElement, progress: number): Promise<void> {
		return new Promise(resolvePromise => {
			this.backgroundPort.postMessage({
				action: Port.BackgroundToContent.Messages.SeekBitmovin,
				progress,
			});

			const resolve = () => {
				video.currentTime = progress;
				this.backgroundPort.onMessage.removeListener(handleResponse);
				clearTimeout(timeoutId);
				resolvePromise();
			};

			const timeoutId = setTimeout(() => {
				log.warn('Seek Bitmovin response timeout, falling back to default seek');
				resolve();
			}, 2000); // 2 second timeout for response

			// biome-ignore lint/suspicious/noExplicitAny: unavoidable due to Chrome extension messaging
			const handleResponse = (message: any) => {
				if (message.action === Port.BackgroundToContent.Messages.SeekBitmovinResponse) {
					clearTimeout(timeoutId);
					log.info('Received seekBitmovinResponse:', message);
					if (!message.success) {
						// Fallback to default seeking if Bitmovin seek fails
						video.currentTime = progress;
					}
					resolve();
				}
			};

			this.backgroundPort.onMessage.addListener(handleResponse);
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
