const logFn = (level: 'info' | 'warn' | 'error') => {
	// biome-ignore lint/suspicious/noExplicitAny: The console.log statement accepts any[]
	return (...args: any[]) => {
		if (__DEBUG__) {
			switch (level) {
				case 'info':
					// biome-ignore lint/suspicious/noConsole: We want to log messages in debug mode
					console.log('[SyncWatch]', ...args);
					break;
				case 'warn':
					console.warn('[SyncWatch]', ...args);
					break;
				case 'error':
					console.error('[SyncWatch]', ...args);
					break;
			}
		}
	};
};

const log = {
	info: logFn('info'),
	warn: logFn('warn'),
	error: logFn('error'),
};

export { log };
