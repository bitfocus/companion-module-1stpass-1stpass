import { combineRgb } from '@companion-module/base'

/**
 * How many camera slots the module exposes as variables, presets and feedback
 * targets.
 *
 * Fixed rather than following the app's camera list, so a button never breaks
 * because a variable disappeared under it and so the presets exist before
 * 1stPass has ever connected. Slots with no camera behind them render blank.
 */
export const MAX_CAMERAS = 20

export type TallyCameraState = 'program' | 'preview' | 'idle'

/** One camera, exactly as 1stPass pushes it in a `tally_state` message. */
export interface TallyCamera {
	number: number
	name: string
	state: TallyCameraState
	/** Which color this camera uses for preview. Program is always red. */
	preview_color: 'green' | 'blue'
	/** The camera's own identity color, bare or '#'-prefixed hex. */
	color: string
}

/*
 * Program is always red: it is safety-critical and universally understood, and
 * an operator who learned a different program color on one rig would be a
 * hazard on every other. Only "next" moves.
 *
 * These pairs are mirrored in two other places and must be kept in step:
 *   1stPass/Shared/Utils/Theme.swift  — accentError / accentSuccess / tallyPreviewBlue
 *   slate/slate-agent.py             — TallyController.PREVIEW_SRGB
 * The blue is Okabe-Ito #0072B2. Note the app and the Slate greens already
 * differ (32D74B vs pure 00FF00); this follows the app, because this button is
 * what sits next to the strip being compared against it.
 */
export const COLOR_PROGRAM = combineRgb(0xff, 0x45, 0x3a)
export const COLOR_PREVIEW_GREEN = combineRgb(0x32, 0xd7, 0x4b)
export const COLOR_PREVIEW_BLUE = combineRgb(0x00, 0x72, 0xb2)
export const COLOR_BLACK = combineRgb(0, 0, 0)
export const COLOR_WHITE = combineRgb(0xff, 0xff, 0xff)
/** An unused slot: dark enough to read as "nothing here", not as "off air". */
export const COLOR_EMPTY_TEXT = combineRgb(0x46, 0x46, 0x46)

/**
 * Parse a 3- or 6-digit hex color into a Companion color number.
 *
 * Lenient in the same ways `Color(hex:)` is on the Swift side: a leading '#' is
 * optional (the app emits '#'-prefixed colors elsewhere, e.g. marker colors)
 * and 3-digit shorthand expands. Anything unparseable falls back to black
 * rather than feeding NaN into `combineRgb`, which would produce an invalid
 * style and a button that renders as garbage.
 */
export function hexToCompanionColor(hex: unknown): number {
	if (typeof hex !== 'string') return COLOR_BLACK
	const clean = hex.trim().replace(/[^0-9a-fA-F]/g, '')
	let full: string
	if (clean.length === 3) {
		full = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
	} else if (clean.length === 6) {
		full = clean
	} else if (clean.length === 8) {
		full = clean.slice(2) // AARRGGBB — drop the alpha, as Color(hex:) does
	} else {
		return COLOR_BLACK
	}
	const value = parseInt(full, 16)
	return Number.isFinite(value) ? value : COLOR_BLACK
}

/**
 * Black or white text, whichever is legible on the given background.
 *
 * Preview may be green or blue, and white-on-green is noticeably worse than
 * black-on-green while white-on-blue is much better than black-on-blue — so
 * this cannot be a constant.
 */
export function readableTextColor(bgcolor: number): number {
	const r = (bgcolor >> 16) & 0xff
	const g = (bgcolor >> 8) & 0xff
	const b = bgcolor & 0xff
	// Rec. 709 luma, which is close enough for a two-way choice.
	const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
	return luma > 0.55 ? COLOR_BLACK : COLOR_WHITE
}

/**
 * The switcher state 1stPass last told us about.
 *
 * Only ever written from a `tally_state` push, so it is the console's truth
 * rather than a record of what this module happened to ask for.
 */
export class TallyState {
	private cameras = new Map<number, TallyCamera>()
	/** Whether the app has ever pushed state, to tell "no cameras" from "no app". */
	private seen = false

	get hasReceivedState(): boolean {
		return this.seen
	}

	get count(): number {
		return this.cameras.size
	}

	get(number: number): TallyCamera | undefined {
		return this.cameras.get(number)
	}

	/** The camera on program / on preview, if any. */
	find(state: TallyCameraState): TallyCamera | undefined {
		for (const camera of this.cameras.values()) {
			if (camera.state === state) return camera
		}
		return undefined
	}

	update(list: TallyCamera[]): void {
		this.cameras.clear()
		for (const camera of list) {
			if (typeof camera?.number === 'number') this.cameras.set(camera.number, camera)
		}
		this.seen = true
	}

	/**
	 * Forget everything on disconnect. The buttons go blank rather than freezing
	 * on a state that may have moved on without us — a tally that lies is worse
	 * than a tally that is plainly dark.
	 */
	clear(): void {
		this.cameras.clear()
		this.seen = false
	}
}
