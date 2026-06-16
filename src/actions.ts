import { combineRgb } from '@companion-module/base'
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
			options: [
				{
					id: 'camera',
					type: 'number',
					label: 'Camera Number',
					default: 1,
					min: 1,
					max: 99,
				},
			],
			callback: async (event) => {
				const camera = Number(event.options.camera) || 1
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
	})
}
