import { combineRgb } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import {
	COLOR_BLACK,
	COLOR_EMPTY_TEXT,
	COLOR_PREVIEW_BLUE,
	COLOR_PREVIEW_GREEN,
	COLOR_PROGRAM,
	hexToCompanionColor,
	MAX_CAMERAS,
	readableTextColor,
} from './tally.js'

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		connection_status: {
			type: 'boolean',
			name: 'Connection Status',
			description: 'Changes button appearance based on connection state',
			defaultStyle: {
				bgcolor: combineRgb(0, 204, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: () => {
				return self.connection.isConnected
			},
		},

		camera_tally: {
			// Advanced rather than boolean: the color is not a style the user
			// configures for an on/off condition, it is computed from state that
			// only 1stPass knows. That also lets one feedback carry the label and
			// the text color alongside the background, so the whole button
			// follows the app and the only thing to configure is a number.
			type: 'advanced',
			name: 'Camera Tally',
			description:
				'Colors the button from 1stPass: red on program, green or blue on preview ' +
				"(following that camera's own setting), dark when off air. Also labels the " +
				'button with the camera name from 1stPass.',
			options: [
				{
					id: 'camera',
					type: 'number',
					label: 'Camera Number',
					default: 1,
					min: 1,
					max: MAX_CAMERAS,
				},
				{
					id: 'use_camera_name',
					type: 'checkbox',
					label: 'Use camera name from 1stPass',
					default: true,
				},
			],
			callback: (feedback) => {
				const number = Number(feedback.options.camera) || 1
				const useName = feedback.options.use_camera_name !== false
				const camera = self.tally.get(number)

				// No camera in this slot — either the show has fewer cameras than
				// this button's number, or 1stPass has not connected yet. Blank and
				// black, so the surface plainly shows which buttons are real.
				if (!camera) {
					return useName
						? { bgcolor: COLOR_BLACK, color: COLOR_EMPTY_TEXT, text: '' }
						: { bgcolor: COLOR_BLACK, color: COLOR_EMPTY_TEXT }
				}

				let bgcolor: number
				let color: number
				switch (camera.state) {
					case 'program':
						bgcolor = COLOR_PROGRAM
						color = readableTextColor(bgcolor)
						break
					case 'preview':
						bgcolor = camera.preview_color === 'blue' ? COLOR_PREVIEW_BLUE : COLOR_PREVIEW_GREEN
						color = readableTextColor(bgcolor)
						break
					default:
						// In the show, off air. The background stays dark so a tally
						// light reading this button goes out, and the camera's own
						// color moves to the text instead: a dimmed camera color
						// would put faint red on an idle camera sitting right next to
						// a bright red live one.
						bgcolor = COLOR_BLACK
						color = hexToCompanionColor(camera.color)
						break
				}

				return useName ? { bgcolor, color, text: camera.name } : { bgcolor, color }
			},
		},
	})
}
