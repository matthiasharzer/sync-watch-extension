import { Port } from './ports';
import type { AnyMessage } from './types';

interface BitmovinPlayerContainer extends HTMLElement {
	player: {
		seek: (time: number) => void;
	};
}

const handleBitmovinSeek = async (tabId: number, progress: number) => {
	try {
		const injectionResults = await chrome.scripting.executeScript({
			target: { tabId: tabId },
			world: 'MAIN',
			func: targetTime => {
				try {
					const container = document.querySelector(
						'div.bitmovinplayer-container',
					) as BitmovinPlayerContainer | null;
					if (container?.player && typeof container.player.seek === 'function') {
						container.player.seek(targetTime);
						return true;
					}
				} catch (error) {
					console.error('Error seeking Bitmovin player:', error);
				}
				return false;
			},
			args: [progress],
		});
		const success = injectionResults[0].result;
		return success;
	} catch (err) {
		console.error('Scripting API Error:', err);
		return false;
	}
};

const handleSeekBitmovin = (request: AnyMessage, port: chrome.runtime.Port) => {
	if (typeof request.progress !== 'number') {
		console.warn('Invalid seekBitmovin message:', request);
		return;
	}
	const tabId = port.sender?.tab?.id;
	if (typeof tabId !== 'number') {
		console.warn('Could not determine sender tab ID for seekBitmovin message');
		return;
	}

	const { progress } = request;

	handleBitmovinSeek(tabId, progress).then(success => {
		port.postMessage({
			action: Port.BackgroundToContent.Messages.SeekBitmovinResponse,
			success,
		});
	});
};

const handleMessage = (request: AnyMessage, port: chrome.runtime.Port) => {
	switch (request.action) {
		case Port.BackgroundToContent.Messages.SeekBitmovin: {
			handleSeekBitmovin(request, port);
			break;
		}
	}
};

chrome.runtime.onConnect.addListener(port => {
	if (port.name === Port.BackgroundToContent.Name) {
		port.onMessage.addListener(handleMessage);
	}
});
