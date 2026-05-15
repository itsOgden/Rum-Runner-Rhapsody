import bgIdleSvg from "../action_svgs/background@2x.svg";
import bgActiveSvg from "../action_svgs/background-active@2x.svg";
import stopIconSvg from "../action_svgs/stop@2x.svg";

const DEFAULT_ACCENT = "#F9B71D";

function sanitize(accent: string): string {
	return /^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : DEFAULT_ACCENT;
}

function extractInner(svg: string): string {
	return svg
		.replace(/<\?xml[^>]*\?>\s*/g, "")
		.replace(/<!DOCTYPE[^>]*>\s*/g, "")
		.replace(/<svg[^>]*>/, "")
		.replace(/<\/svg>\s*$/, "")
		.trim();
}

function compose(accent: string, bg: string, icon?: string): string {
	const a = sanitize(accent);
	// Replace white fills in the background with the accent color
	const bgInner = extractInner(bg).replace(/fill:#fff/g, `fill:${a}`);
	const iconInner = icon ? extractInner(icon) : "";
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">${bgInner}${iconInner}</svg>`;
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export function buildPlaySoundImage(accent: string, isPlaying: boolean): string {
	return isPlaying ? compose(accent, bgActiveSvg) : compose(accent, bgIdleSvg);
}

export function buildStopImage(accent: string): string {
	return compose(accent, bgIdleSvg, stopIconSvg);
}
