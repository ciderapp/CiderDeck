/**
 * Recursive deep-merge of plain objects, ported from the legacy CiderDeck
 * `deepMerge` helper. Used to layer persisted settings over defaults while
 * tolerating older nested shapes (backward compatibility).
 *
 * Arrays and non-plain values are replaced, not merged. `source` wins.
 */
export function deepMerge<T>(target: T, source: Partial<T> | undefined): T {
	if (source == null) return target;
	if (!isPlainObject(target) || !isPlainObject(source)) {
		return (source as T) ?? target;
	}

	const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
	for (const key of Object.keys(source as Record<string, unknown>)) {
		const sv = (source as Record<string, unknown>)[key];
		const tv = out[key];
		if (sv === undefined) continue;
		if (isPlainObject(sv) && isPlainObject(tv)) {
			out[key] = deepMerge(tv, sv as Record<string, unknown>);
		} else {
			out[key] = sv;
		}
	}
	return out as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
