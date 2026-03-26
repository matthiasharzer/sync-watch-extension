import { log } from './log';
import { Message } from './messages';
import type { AnyMessage } from './types';

const $ = document.querySelector.bind(document);

const createRoomButton = $('#create-room-button') as HTMLButtonElement;

const disconnectedContainer = $('#disconnected') as HTMLDivElement;
const connectedContainer = $('#connected') as HTMLDivElement;

const roomIdInput = $('#room-id-input') as HTMLInputElement;
const joinRoomButton = $('#join-room-button') as HTMLButtonElement;
const roomIdLabel = $('#room-id') as HTMLLabelElement;

const roomUrlInput = $('#room-url-input') as HTMLInputElement;
const leaveRoomButton = $('#leave-room-button') as HTMLButtonElement;
const copyRoomUrlButton = $('#copy-room-url-button') as HTMLButtonElement;
const errorMessage = $('#error-message') as HTMLParagraphElement;

const getActiveTab = () =>
	new Promise<chrome.tabs.Tab>(resolve => {
		chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
			resolve(tabs[0]);
		});
	});

const setStatus = (status: 'connected' | 'disconnected') => {
	if (status === 'connected') {
		disconnectedContainer.classList.add('hidden');
		connectedContainer.classList.remove('hidden');
	} else {
		disconnectedContainer.classList.remove('hidden');
		connectedContainer.classList.add('hidden');
	}
};

const setError = (message: string) => {
	errorMessage.textContent = message;
};

const setRoomId = (roomId: string) => {
	getActiveTab().then(tab => {
		if (!tab?.url) {
			roomUrlInput.value = roomId;
			return;
		}
		const url = new URL(tab.url || '');
		url.searchParams.set('roomId', roomId);
		roomUrlInput.value = url.toString();
		roomUrlInput.scrollLeft = roomUrlInput.scrollWidth;
	});

	roomIdLabel.textContent = roomId;
};

const handleClearRoom = () => {
	setStatus('disconnected');
};

const handleSetRoomId = (roomId: string) => {
	setRoomId(roomId);
};

const handleMessage = (message: AnyMessage) => {
	if (typeof message !== 'object' || message === null || typeof message.action !== 'string') {
		log.warn('Received invalid message:', message);
		return;
	}

	switch (message.action) {
		case Message.ClearRoom:
			handleClearRoom();
			break;
		case Message.SetRoomId:
			if (typeof message.roomId === 'string') {
				handleSetRoomId(message.roomId);
			} else {
				log.warn('Received invalid roomId:', message.roomId);
			}
			break;
	}
};

const sendMessage = <M, R = AnyMessage>(message: M, callback?: (response: R) => void) => {
	getActiveTab().then(tab => {
		if (!tab?.id) {
			log.error('No active tab found');
			return;
		}
		if (callback) {
			chrome.tabs.sendMessage(tab.id, message, callback);
		} else {
			chrome.tabs.sendMessage(tab.id, message);
		}
	});
};

const init = () => {
	setStatus('disconnected');
	sendMessage({ action: Message.GetCurrentRoom }, response => {
		if (response?.roomId) {
			setStatus('connected');
			setRoomId(response.roomId);
		}
	});
	sendMessage({ action: Message.HasVideoElement }, response => {
		if (!response?.hasVideo) {
			setError(
				'No video element found on the page. Please navigate to a page with a video and try again.',
			);
		}
	});

	chrome.runtime.onMessage.addListener(message => {
		handleMessage(message);
	});

	createRoomButton.addEventListener('click', () => {
		sendMessage({ action: Message.CreateRoom }, response => {
			if (response?.roomId) {
				setStatus('connected');
				setRoomId(response.roomId);
			}
		});
	});

	joinRoomButton.addEventListener('click', () => {
		const roomId = roomIdInput.value.trim();
		if (roomId) {
			sendMessage({ action: Message.JoinRoom, roomId }, response => {
				if (response?.success) {
					setStatus('connected');
					setRoomId(roomId);
				} else {
					setError('Failed to join room. Please check the Room ID and try again.');
				}
			});
		} else {
			setError('Please enter a valid Room ID.');
		}
	});

	leaveRoomButton.addEventListener('click', () => {
		sendMessage({ action: Message.LeaveRoom }, () => {
			handleClearRoom();
		});
	});

	copyRoomUrlButton.addEventListener('click', () => {
		roomUrlInput.select();
		document.execCommand('copy');
	});
};

init();
