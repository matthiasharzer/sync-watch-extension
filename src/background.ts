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
						'.div.bitmovinplayer-container',
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

// TODO: Implement port based communication?
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'seekBitmovin') {
		const { progress } = request;
		if (sender.tab?.id) {
			handleBitmovinSeek(sender.tab.id, progress).then(success => {
				sendResponse({ success });
			});
			return true;
		} else {
			sendResponse({ success: false, error: 'No tab ID' });
		}
	}
});
