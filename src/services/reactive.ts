type Subscriber<T> = (value: T) => void;
type Unsubscribe = () => void;

interface ReadOnlyObservable<T> {
	readonly value: T;
	next(): Promise<T>;
	subscribe(subscriber: Subscriber<T>, includeCurrentValue: boolean): Unsubscribe;
	unsubscribe(subscriber: Subscriber<T>): void;
}

interface ReadWriteObservable<T> extends ReadOnlyObservable<T> {
	set(value: T): void;
}

class Observable<T> implements ReadWriteObservable<T> {
	protected observableValue: T;
	protected subscribers: Subscriber<T>[] = [];

	constructor(initialValue: T) {
		this.observableValue = initialValue;
	}

	protected notifySubscribers() {
		for (const subscriber of this.subscribers) {
			subscriber(this.observableValue);
		}
	}

	get value() {
		return this.observableValue;
	}

	set value(value: T) {
		this.set(value);
	}

	set(value: T) {
		if (this.observableValue === value) {
			return;
		}

		this.observableValue = value;
		this.notifySubscribers();
	}

	next(): Promise<T> {
		return new Promise(resolve => {
			const unsubscribe = this.subscribe(value => {
				resolve(value);
				unsubscribe();
			}, false);
		});
	}

	subscribe(subscriber: Subscriber<T>, includeCurrentValue: boolean): Unsubscribe {
		this.subscribers.push(subscriber);

		if (includeCurrentValue) {
			subscriber(this.observableValue);
		}

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

	hostConnected(): void {
		// no-op
	}
}

export type { ReadOnlyObservable, ReadWriteObservable, Subscriber, Unsubscribe };
export { Observable };
