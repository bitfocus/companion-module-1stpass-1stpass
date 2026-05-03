import type { ModuleInstance } from './main.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions([
		{ variableId: 'connection_status', name: 'Connection Status' },
		{ variableId: 'last_marker_timecode', name: 'Last Marker Timecode' },
		{ variableId: 'last_marker_text', name: 'Last Marker Text' },
		{ variableId: 'last_title_timecode', name: 'Last Title Timecode' },
		{ variableId: 'last_cut_timecode', name: 'Last Camera Cut Timecode' },
		{ variableId: 'last_fade_timecode', name: 'Last Camera Fade Timecode' },
		{ variableId: 'standby_camera', name: 'Standby Camera Name' },
	])

	self.setVariableValues({
		connection_status: 'Disconnected',
		last_marker_timecode: '',
		last_marker_text: '',
		last_title_timecode: '',
		last_cut_timecode: '',
		last_fade_timecode: '',
		standby_camera: '',
	})
}
