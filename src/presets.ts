import { combineRgb, type CompanionPresetDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { COLOR_BLACK, COLOR_WHITE, MAX_CAMERAS } from './tally.js'

/**
 * One preset per camera slot, so setting up a camera button is a single drag.
 *
 * Each carries both halves of what the operator wants: the action that puts
 * that camera on preview, and the feedback that colors and labels the button
 * from 1stPass. Nothing is left to fill in — the camera number is baked in, and
 * the name, text color and background all arrive from the app.
 */
export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	for (let number = 1; number <= MAX_CAMERAS; number++) {
		presets[`camera_${number}`] = {
			type: 'button',
			category: 'Cameras',
			name: `Camera ${number}`,
			// The disconnected fallback, and nothing more. As soon as 1stPass is
			// connected the feedback overrides all three of these with the real
			// camera name and its tally colors.
			style: {
				text: `CAM ${number}`,
				size: '18',
				color: COLOR_WHITE,
				bgcolor: COLOR_BLACK,
			},
			// Without a preview style the browser shows twenty identical black
			// tiles with no way to tell Camera 7 from Camera 12.
			previewStyle: {
				text: `CAM ${number}`,
				size: '18',
				color: COLOR_WHITE,
				bgcolor: combineRgb(0x33, 0x33, 0x33),
			},
			steps: [
				{
					down: [{ actionId: 'select_camera', options: { camera: number } }],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'camera_tally_name',
					options: { camera: number, use_camera_name: true },
				},
			],
		}
	}

	// The quick marker needs nothing set: the type and color come from the
	// console until someone chooses otherwise in the button's options.
	presets.quick_marker = {
		type: 'button',
		category: 'Markers',
		name: 'Quick Marker',
		style: {
			text: 'QUICK\nMARKER',
			size: '14',
			color: COLOR_WHITE,
			bgcolor: combineRgb(0x00, 0x7a, 0xff),
		},
		steps: [
			{
				down: [
					{
						actionId: 'quick_marker',
						options: { type: 'default', override_color: false, color: combineRgb(0, 122, 255) },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	self.setPresetDefinitions(presets)
}
