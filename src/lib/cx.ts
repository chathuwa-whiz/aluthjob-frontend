/** Joins class names, skipping anything falsy. */
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
