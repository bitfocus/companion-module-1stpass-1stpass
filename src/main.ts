import { InstanceBase, runEntrypoint, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { TallyState } from './tally.js'

import { ConnectionManager } from './connection.js'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig
	connection!: ConnectionManager
	/** Switcher state pushed by 1stPass. Drives the camera buttons. */
	readonly tally = new TallyState()

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.connection = new ConnectionManager(this)

		this.updateStatus(InstanceStatus.Disconnected)

		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()

		this.updateVariableDefinitions()

		this.connection.connect()
	}

	async destroy(): Promise<void> {
		this.connection.disconnect()
		this.log('debug', 'Module destroyed')
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.connection.disconnect()
		this.connection.connect()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
