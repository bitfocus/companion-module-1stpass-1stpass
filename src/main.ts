import { InstanceBase, runEntrypoint, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'

import { ConnectionManager } from './connection.js'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig
	connection!: ConnectionManager

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.connection = new ConnectionManager(this)

		this.updateStatus(InstanceStatus.Disconnected)

		this.updateActions()
		this.updateFeedbacks()

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

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
