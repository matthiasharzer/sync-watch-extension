import { Message } from './messages';
import { createRoom, RoomFeed } from './services/api';
import { Controller } from './services/controller';
import { CrunchyrollVideoPlayerSyncStrategy } from './services/strategies/crunchyroll';
import { DefaultVideoPlayerSyncStrategy } from './services/strategies/default';
import type { VideoPlayerSyncStrategy } from './services/strategies/strategy';
import type { AnyMessage } from './types';

const $ = document.querySelector.bind(document);
let videoElement = $('video') as HTMLVideoElement | null;

const customStrategies: Record<string, VideoPlayerSyncStrategy> = {
	'(?:^|\\.)crunchyroll\\.com$': new CrunchyrollVideoPlayerSyncStrategy(),
};

const controller: Controller = new Controller();

const handleCreateRoom = async () => {
	try {
		const roomId = await createRoom();
		const feed = new RoomFeed(roomId);
		controller.setFeed(feed);

		return { success: true, roomId };
	} catch (error) {
		if (error instanceof Error) {
			console.error('Error creating room:', error);
			return { success: false, error: error.message };
		}
		console.error('Unknown error creating room:', error);
		return { success: false, error: 'Unknown error' };
	}
};

const handleJoinRoom = async (roomId: string) => {
	try {
		const subscription = new RoomFeed(roomId);
		controller.setFeed(subscription);
		return { success: true };
	} catch (error) {
		if (error instanceof Error) {
			console.error('Error joining room:', error);
			return { success: false, error: error.message };
		}
		console.error('Unknown error joining room:', error);
		return { success: false, error: 'Unknown error' };
	}
};

const handleLeaveRoom = async () => {
	if (controller.feed) {
		controller.feed.close();
		return { success: true };
	}
	return { success: false, error: 'Not in a room' };
};

const handleGetCurrentRoom = async () => {
	if (controller.roomId) {
		return { roomId: controller.roomId };
	}
	return { roomId: null };
};

const handleMessage = async (message: AnyMessage) => {
	if (typeof message !== 'object' || message === null || typeof message.action !== 'string') {
		console.warn('Received invalid message:', message);
		return;
	}

	switch (message.action) {
		case Message.CreateRoom:
			return await handleCreateRoom();
		case Message.JoinRoom:
			if (typeof message.roomId === 'string') {
				return await handleJoinRoom(message.roomId);
			} else {
				return { success: false, error: 'Invalid roomId' };
			}
		case Message.LeaveRoom:
			return await handleLeaveRoom();
		case Message.GetCurrentRoom:
			return await handleGetCurrentRoom();
		case Message.HasVideoElement:
			return { hasVideo: !!videoElement };
		default:
			console.warn('Unknown action:', message.action);
			return { success: false, error: 'Unknown action' };
	}
};

const sendMessage = <M, R>(message: M, callback?: (response: R) => void) => {
	if (callback) {
		chrome.runtime.sendMessage(message, callback);
	} else {
		chrome.runtime.sendMessage(message);
	}
};

const findAndSetVideoElement = () => {
	videoElement = $('video') as HTMLVideoElement | null;
	if (!videoElement) {
		setTimeout(findAndSetVideoElement, 1000);
		return;
	}

	controller.setVideo(videoElement);
};

const getStrategyForCurrentSite = (): VideoPlayerSyncStrategy => {
	const hostname = window.location.hostname;
	for (const pattern in customStrategies) {
		const regex = new RegExp(pattern);
		if (regex.test(hostname)) {
			return customStrategies[pattern];
		}
	}

	return new DefaultVideoPlayerSyncStrategy();
};

const init = () => {
	findAndSetVideoElement();
	const strategy = getStrategyForCurrentSite();
	controller.setStrategy(strategy);

	chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
		handleMessage(message)
			.then(response => {
				sendResponse(response);
			})
			.catch(error => {
				console.error('Error handling message:', error);
				sendResponse({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			});
		return true; // Indicate that we will send a response asynchronously
	});

	controller.connectionState.subscribe(state => {
		if (state === 'idle') {
			sendMessage({ action: Message.ClearRoom });
		}
	}, false);

	const urlParams = new URLSearchParams(window.location.search);
	const initialRoomId = urlParams.get('roomId');
	if (!initialRoomId) {
		return;
	}

	try {
		const feed = new RoomFeed(initialRoomId);
		controller.setFeed(feed);
		chrome.runtime.sendMessage({
			action: Message.SetRoomId,
			roomId: initialRoomId,
		});
	} catch (error) {
		console.error('Error joining room from URL:', error);
	}
};

init();
