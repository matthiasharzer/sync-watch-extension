// biome-ignore lint/suspicious/noExplicitAny: The console.log statement accepts any[]
const log = (...args: any[]) => {
	// biome-ignore lint/suspicious/noConsole: Controlled logging function that can be easily disabled in production
	__DEBUG__ && console.log('[SyncWatch]', ...args);
};

export { log };
