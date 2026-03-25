type Subscriber<T> = (value: T) => void;
type Unsubscribe = () => void;

interface ReadonlySubscibable<T> {
	subscribe(subscriber: Subscriber<T>, includeCurrentValue: boolean): Unsubscribe;
	unsubscribe(subscriber: Subscriber<T>): void;
}

type ReadOnlyFeed<T> = ReadonlySubscibable<T>;
interface ReadWriteFeed<T> extends ReadOnlyFeed<T> {
	readonly latestValue: T;
	publish(value: T): void;
}

type ReadOnlyObservable<T> = ReadonlySubscibable<T>;
interface ReadWriteObservable<T> extends ReadOnlyObservable<T> {
	readonly value: T;
	set(value: T): void;
}

class Subscribable<T> {
	private subscribers: Subscriber<T>[] = [];

	notifySubscribers(value: T) {
		for (const subscriber of this.subscribers) {
			subscriber(value);
		}
	}

	subscribe(subscriber: Subscriber<T>): Unsubscribe {
		this.subscribers.push(subscriber);

		return () => this.unsubscribe(subscriber);
	}

	unsubscribe(subscriber: Subscriber<T>) {
		this.subscribers = this.subscribers.filter(s => s !== subscriber);
	}

	disconnect() {
		for (const subscriber of this.subscribers.slice()) {
			this.unsubscribe(subscriber);
		}
	}
}

class Feed<T> implements ReadWriteFeed<T> {
	protected latestFeedValue: T;
	protected subs = new Subscribable<T>();

	constructor(initialValue: T) {
		this.latestFeedValue = initialValue;
	}

	get latestValue() {
		return this.latestFeedValue;
	}

	publish(value: T) {
		if (this.latestFeedValue === value) {
			return;
		}

		this.latestFeedValue = value;
		this.subs.notifySubscribers(value);
	}

	subscribe(subscriber: Subscriber<T>, includeLatestValue: boolean): Unsubscribe {
		if (includeLatestValue) {
			subscriber(this.latestFeedValue);
		}

		return this.subs.subscribe(subscriber);
	}

	unsubscribe(subscriber: Subscriber<T>) {
		this.subs.unsubscribe(subscriber);
	}

	disconnect() {
		this.subs.disconnect();
	}
}

class Observable<T> implements ReadWriteObservable<T> {
	protected feed: Feed<T>;

	constructor(initialValue: T) {
		this.feed = new Feed(initialValue);
	}

	get value() {
		return this.feed.latestValue;
	}

	set(value: T) {
		if (this.feed.latestValue === value) {
			return;
		}

		this.feed.publish(value);
	}

	subscribe(subscriber: Subscriber<T>, includeLatestValue: boolean): Unsubscribe {
		return this.feed.subscribe(subscriber, includeLatestValue);
	}

	unsubscribe(subscriber: Subscriber<T>) {
		this.feed.unsubscribe(subscriber);
	}

	disconnect() {
		this.feed.disconnect();
	}
}

export type {
	ReadOnlyFeed,
	ReadOnlyObservable,
	ReadWriteFeed,
	ReadWriteObservable,
	Subscriber,
	Unsubscribe,
};

export { Feed, Observable };
