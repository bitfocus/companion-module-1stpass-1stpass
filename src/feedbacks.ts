import { combineRgb } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

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
	})
}
