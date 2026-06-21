/**
 * Single shared animation clock for all marquee / motion consumers. One
 * `setInterval` drives every subscriber; it starts on the first subscription and
 * stops when the last one leaves, so there are no idle timers.
 */

const DEFAULT_FPS = 8;

export class AnimationTicker {
	private timer?: ReturnType<typeof setInterval>;
	private readonly subscribers = new Map<string, () => void>();

	constructor(private readonly intervalMs = Math.round(1000 / DEFAULT_FPS)) {}

	subscribe(id: string, onTick: () => void): void {
		this.subscribers.set(id, onTick);
		if (!this.timer) {
			this.timer = setInterval(() => this.tick(), this.intervalMs);
		}
	}

	unsubscribe(id: string): void {
		this.subscribers.delete(id);
		if (this.subscribers.size === 0 && this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	private tick(): void {
		for (const cb of this.subscribers.values()) {
			try {
				cb();
			} catch {
				/* a misbehaving consumer must not stop the clock */
			}
		}
	}
}

/**
 * Returns a `width`-character window into `text` that advances by `offset`
 * characters, wrapping around with a separator - the classic single-line
 * marquee. Returns `text` unchanged when it already fits.
 */
export function marqueeWindow(text: string, width: number, offset: number, separator = "   •   "): string {
	if (text.length <= width) return text;
	const full = text + separator;
	const start = ((offset % full.length) + full.length) % full.length;
	return (full + full).substring(start, start + width);
}
