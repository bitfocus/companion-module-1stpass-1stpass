import { combineRgb, type CompanionActionDefinition } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

// Companion internal variable that resolves to the button's display text
const BUTTON_TEXT_VARIABLE = '$(internal:b_text_$(this:page)_$(this:row)_$(this:column))'

// Color palette matching the SwiftUI Edit Marker dialog
const PRESET_COLORS = ['#007AFF', '#34C759', '#FF3B30', '#FF9500', '#AF52DE', '#5856D6', '#00C7BE', '#FFCC00']

// Default marker color (1stPass blue) used as fallback when the colorpicker value is invalid
const DEFAULT_MARKER_COLOR = '#007AFF'

const DEFAULT_TYPE_ID = 'default'

/** Convert a companion numeric color (from combineRgb / colorpicker) to #RRGGBB hex string.
 * Returns null when the input isn't a usable 0..0xFFFFFF integer so the caller can choose a fallback
 * instead of silently sending black.
 */
function colorToHex(color: unknown): string | null {
	if (typeof color !== 'number' || !Number.isFinite(color) || color < 0 || color > 0xffffff) {
		return null
	}
	const r = (color >> 16) & 0xff
	const g = (color >> 8) & 0xff
	const b = color & 0xff
	return (
		'#' +
		r.toString(16).padStart(2, '0') +
		g.toString(16).padStart(2, '0') +
		b.toString(16).padStart(2, '0')
	).toUpperCase()
}

/** The camera-number field, shared by every per-camera action so they all read
 * and behave the same on a button. Matches `select_camera`'s field exactly.
 */
function cameraOption() {
	return {
		id: 'camera',
		type: 'number' as const,
		label: 'Camera Number',
		default: 1,
		min: 1,
		max: 99,
	}
}

/** True when 1stPass has told us its camera list and this number isn't in it.
 *
 * A surface carries a button per camera whether or not the show has that many,
 * so most rigs have buttons for cameras that don't exist. Sending to those would
 * come back an error and park it in `last_error`, which an operator may well
 * have on a status button. Until the app has told us what exists we send
 * anyway — silence would be worse than a stray warning.
 */
function noSuchCamera(self: ModuleInstance, camera: number): boolean {
	return self.tally.hasReceivedState && !self.tally.get(camera)
}

/** One camera control that a button can nudge up or down.
 *
 * `key` becomes the action ids `camera_<key>_up` / `camera_<key>_down` and must
 * never change once shipped — it is what a saved button refers to.
 *
 * `up` and `down` spell out what the press does, because `+` is not
 * self-explanatory on most of these. 1stPass hands the app each camera's own
 * value ladder darkest-first, so `+` means brighter on shutter, EV and ISO —
 * but iris is deliberately the other way round, since an f-number *increases*
 * as the lens closes, and that is the direction a shooter reads a lens in.
 */
interface Stepper {
	key: string
	label: string
	property: string
	up: string
	down: string
}

const EXPOSURE_STEPPERS: Stepper[] = [
	{
		key: 'iris',
		label: 'Iris',
		property: 'aperture',
		up: 'closes the iris one stop (a higher f-number)',
		down: 'opens the iris one stop (a lower f-number)',
	},
	{
		key: 'shutter',
		label: 'Shutter',
		property: 'shutter',
		up: 'lengthens the shutter one step (brighter)',
		down: 'shortens the shutter one step (darker)',
	},
	{
		key: 'ev',
		label: 'EV',
		property: 'exposure_compensation',
		up: 'raises exposure compensation one step',
		down: 'lowers exposure compensation one step',
	},
	{ key: 'iso', label: 'ISO', property: 'iso', up: 'raises ISO one step', down: 'lowers ISO one step' },
	{
		key: 'wb',
		label: 'WB',
		property: 'white_balance',
		up: 'raises the color temperature one step (warmer picture)',
		down: 'lowers the color temperature one step (cooler picture)',
	},
]

/** The shading controls — the trims a shot gets painted with. Kept in their own
 * list so the action picker reads in the order an operator works in.
 */
const SHADING_STEPPERS: Stepper[] = [
	{
		key: 'pedestal',
		label: 'Master Pedestal',
		property: 'master_pedestal',
		up: 'lifts the black level one step',
		down: 'crushes the black level one step',
	},
	{
		key: 'wb_shift_ab',
		label: 'WB Shift Amber/Blue',
		property: 'wb_shift_amber_blue',
		up: 'shifts white balance one step toward blue',
		down: 'shifts white balance one step toward amber',
	},
	{
		key: 'wb_shift_gm',
		label: 'WB Shift Green/Magenta',
		property: 'wb_shift_green_magenta',
		up: 'shifts white balance one step toward magenta',
		down: 'shifts white balance one step toward green',
	},
	{
		key: 'saturation',
		label: 'Saturation',
		property: 'saturation',
		up: 'raises saturation one step',
		down: 'lowers saturation one step',
	},
	{
		key: 'color_phase',
		label: 'Color Phase',
		property: 'color_phase',
		up: 'rotates color phase one step toward magenta',
		down: 'rotates color phase one step toward green',
	},
]

/** Build the up/down pair of actions for one control. */
function stepperActions(self: ModuleInstance, stepper: Stepper): Record<string, CompanionActionDefinition> {
	const make = (steps: number, sign: string, what: string): CompanionActionDefinition => {
		const name = `Camera ${stepper.label} ${sign}`
		return {
			name,
			description: `On the camera bound to this cell, ${what}.`,
			options: [cameraOption()],
			callback: async (event) => {
				const camera = Number(event.options.camera) || 1
				if (noSuchCamera(self, camera)) {
					self.log('debug', `Ignoring ${name} ${camera}: no such camera in 1stPass`)
					return
				}
				self.connection.send({ command: 'camera_step', camera, property: stepper.property, steps })
			},
		}
	}
	return {
		[`camera_${stepper.key}_up`]: make(1, '+', stepper.up),
		[`camera_${stepper.key}_down`]: make(-1, '−', stepper.down),
	}
}

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		create_marker: {
			name: 'Create Marker',
			description: 'Create a marker at the current timecode',
			options: [
				{
					id: 'marker_source',
					type: 'dropdown',
					label: 'Marker Text',
					default: 'button_text',
					choices: [
						{ id: 'button_text', label: 'Button Text String' },
						{ id: 'custom', label: 'Custom' },
					],
				},
				{
					id: 'button_text',
					type: 'textinput',
					label: 'Button Text Source (hidden)',
					default: BUTTON_TEXT_VARIABLE,
					useVariables: { local: true },
					isVisibleExpression: 'false',
				},
				{
					id: 'text',
					type: 'textinput',
					label: 'Custom Text',
					default: 'Marker',
					useVariables: true,
					isVisibleExpression: "$(options:marker_source) == 'custom'",
				},
				{
					id: 'type',
					type: 'dropdown',
					label: 'Type',
					default: DEFAULT_TYPE_ID,
					choices: [
						{ id: DEFAULT_TYPE_ID, label: 'Default' },
						{ id: 'standard', label: 'Standard' },
						{ id: 'todo', label: 'To Do' },
						{ id: 'chapter', label: 'Chapter' },
					],
				},
				{
					id: 'override_color',
					type: 'checkbox',
					label: 'Custom Color',
					default: false,
				},
				{
					id: 'color',
					type: 'colorpicker',
					label: 'Color',
					default: combineRgb(0, 122, 255),
					presetColors: PRESET_COLORS,
					isVisibleExpression: '$(options:override_color)',
				},
			],
			callback: async (event, context) => {
				// Local variables like $(this:page) only resolve through the per-call context.
				// self.parseVariablesInString has no control context, so it returns the raw token.
				let markerText: string
				if (event.options.marker_source === 'button_text') {
					const raw = String(event.options.button_text || '')
					markerText = await context.parseVariablesInString(raw)
				} else {
					const raw = String(event.options.text || 'Marker')
					markerText = await context.parseVariablesInString(raw)
				}

				const overrideColor = Boolean(event.options.override_color)
				const typeOverride = String(event.options.type || '')

				const command: Record<string, unknown> = {
					command: 'create_marker',
					text: markerText,
				}
				if (overrideColor) {
					const hex = colorToHex(event.options.color)
					if (hex === null) {
						self.log('warn', `Custom color invalid (${String(event.options.color)}); using default`)
						command.color = DEFAULT_MARKER_COLOR
					} else {
						command.color = hex
					}
				}
				if (typeOverride && typeOverride !== DEFAULT_TYPE_ID) {
					command.type = typeOverride
				}

				self.connection.send(command)
			},
		},

		next_title: {
			name: 'Next Title',
			description: 'Record the next title in sequence at the current timecode',
			options: [],
			callback: async () => {
				self.connection.send({ command: 'next_title' })
			},
		},

		select_camera: {
			name: 'Select Camera',
			description: 'Set a camera to standby (preview). Does nothing if already in standby.',
			options: [cameraOption()],
			callback: async (event) => {
				const camera = Number(event.options.camera) || 1
				if (noSuchCamera(self, camera)) {
					self.log('debug', `Ignoring select_camera ${camera}: no such camera in 1stPass`)
					return
				}
				self.connection.send({ command: 'select_camera', camera })
			},
		},

		camera_cut: {
			name: 'Camera Cut',
			description: 'Cut to the standby camera (promotes standby to program) and record to timeline',
			options: [],
			callback: async () => {
				self.connection.send({ command: 'camera_cut' })
			},
		},

		camera_fade: {
			name: 'Camera Fade',
			description:
				'Fade to the standby camera. Records a fade transition to the timeline using the event’s configured fade duration.',
			options: [],
			callback: async () => {
				self.connection.send({ command: 'camera_fade' })
			},
		},

		// Camera body control. These reach the physical camera bound to that
		// cell in 1stPass — not the switcher. A camera with no body bound, or
		// one whose current mode owns the property, is a no-op the app reports
		// back for the log; it is not an error and leaves `last_error` alone.
		camera_focus: {
			name: 'Camera Focus (AF push)',
			description:
				'Push one-shot autofocus on the camera bound to this cell. The camera must be in manual focus — a body already autofocusing refuses the push.',
			options: [cameraOption()],
			callback: async (event) => {
				const camera = Number(event.options.camera) || 1
				if (noSuchCamera(self, camera)) {
					self.log('debug', `Ignoring camera_focus ${camera}: no such camera in 1stPass`)
					return
				}
				self.connection.send({ command: 'camera_focus', camera })
			},
		},

		// Exposure first, then shading: ten controls, each with an up and a down.
		...Object.assign({}, ...[...EXPOSURE_STEPPERS, ...SHADING_STEPPERS].map((s) => stepperActions(self, s))),
	})
}
