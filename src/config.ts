import type { SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	port: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Host',
			default: 'localhost',
			width: 8,
		},
		{
			type: 'number',
			id: 'port',
			label: 'Port',
			default: 19455,
			min: 1,
			max: 65535,
			width: 4,
		},
	]
}
