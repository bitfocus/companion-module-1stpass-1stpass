import type { ModuleInstance } from './main.js'
import { MAX_CAMERAS } from './tally.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	// A fixed set rather than one per camera the app reports: a variable that
	// disappeared when a camera was deleted would leave a broken reference on
	// every button using it. Unused slots simply read empty.
	const cameraDefinitions = []
	const cameraValues: Record<string, string> = {}
	for (let n = 1; n <= MAX_CAMERAS; n++) {
		cameraDefinitions.push({ variableId: `camera_${n}_name`, name: `Camera ${n} Name` })
		cameraDefinitions.push({ variableId: `camera_${n}_state`, name: `Camera ${n} State` })
		cameraValues[`camera_${n}_name`] = ''
		cameraValues[`camera_${n}_state`] = ''
	}

	self.setVariableDefinitions([
		{ variableId: 'connection_status', name: 'Connection Status' },
		{ variableId: 'last_marker_timecode', name: 'Last Marker Timecode' },
		{ variableId: 'last_marker_text', name: 'Last Marker Text' },
		{ variableId: 'last_title_timecode', name: 'Last Title Timecode' },
		{ variableId: 'last_cut_timecode', name: 'Last Camera Cut Timecode' },
		{ variableId: 'last_fade_timecode', name: 'Last Camera Fade Timecode' },
		{ variableId: 'program_camera', name: 'Program Camera Name' },
		{ variableId: 'standby_camera', name: 'Standby Camera Name' },
		{ variableId: 'last_error', name: 'Last Error' },
		...cameraDefinitions,
	])

	self.setVariableValues({
		connection_status: 'Disconnected',
		last_marker_timecode: '',
		last_marker_text: '',
		last_title_timecode: '',
		last_cut_timecode: '',
		last_fade_timecode: '',
		program_camera: '',
		standby_camera: '',
		last_error: '',
		...cameraValues,
	})
}
