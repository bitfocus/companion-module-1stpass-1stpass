import WebSocket from 'ws'
import { InstanceStatus } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

const RECONNECT_INTERVAL = 5000
const PING_INTERVAL = 15000

export interface ServerResponse {
	status: 'ok' | 'error'
	marker?: {
		id: string
		timecode: string
		text: string
	}
	title?: {
		id: string
		timecode: string
		titleIndex: number
		title1: string
	}
	// Native server format (flat fields)
	timecode?: string
	command?: string
	error?: string
	message?: string
}

export class ConnectionManager {
	private ws: WebSocket | null = null
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private pingTimer: ReturnType<typeof setInterval> | null = null
	private intentionalClose = false
	private self: ModuleInstance

	constructor(self: ModuleInstance) {
		this.self = self
	}

	connect(): void {
		this.cleanup()
		this.intentionalClose = false

		const { host, port } = this.self.config
		const url = `ws://${host}:${port}`

		this.self.log('info', `Connecting to ${url}`)
		this.self.updateStatus(InstanceStatus.Connecting)

		try {
			this.ws = new WebSocket(url)
		} catch (err) {
			this.self.log('error', `Failed to create WebSocket: ${err}`)
			this.self.updateStatus(InstanceStatus.ConnectionFailure)
			this.scheduleReconnect()
			return
		}

		this.ws.on('open', () => {
			this.self.log('info', 'Connected')
			this.self.updateStatus(InstanceStatus.Ok)
			this.self.setVariableValues({ connection_status: 'Connected' })
			this.self.checkFeedbacks('connection_status')
			this.startPing()
		})

		this.ws.on('message', (data: WebSocket.Data) => {
			this.handleMessage(data)
		})

		this.ws.on('close', () => {
			this.self.log('info', 'Connection closed')
			this.onDisconnect()
			if (!this.intentionalClose) {
				this.scheduleReconnect()
			}
		})

		this.ws.on('error', (err: Error) => {
			this.self.log('error', `WebSocket error: ${err.message}`)
			// close event will fire after error, handling reconnect there
		})
	}

	disconnect(): void {
		this.intentionalClose = true
		this.cleanup()
	}

	send(data: Record<string, unknown>): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data))
		} else {
			this.self.log('warn', 'Cannot send: not connected')
		}
	}

	get isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN
	}

	private handleMessage(data: WebSocket.Data): void {
		try {
			const msg = JSON.parse(data.toString())

			// Handle relay server wrapper format: {type: 'marker_response', response: {...}}
			if (msg.type === 'marker_response' && msg.response) {
				this.processResponse(msg.response as ServerResponse)
				return
			}

			// Handle welcome message
			if (msg.type === 'welcome') {
				this.self.log('debug', 'Received welcome from server')
				return
			}

			// Handle direct response format (native server)
			if (msg.status) {
				this.processResponse(msg as ServerResponse)
				return
			}
		} catch (err) {
			this.self.log('warn', `Failed to parse message: ${err}`)
		}
	}

	private processResponse(response: ServerResponse): void {
		if (response.status === 'error') {
			this.self.log('warn', `Server error: ${response.message || response.error || 'Unknown error'}`)
			return
		}

		// Marker response (relay server format)
		if (response.marker) {
			this.self.setVariableValues({
				last_marker_timecode: response.marker.timecode,
				last_marker_text: response.marker.text,
			})
			this.self.log('info', `Marker created: ${response.marker.text} @ ${response.marker.timecode}`)
		}

		// Title response (relay server format)
		if (response.title) {
			this.self.setVariableValues({
				last_title_timecode: response.title.timecode,
			})
			this.self.log('info', `Title recorded: ${response.title.title1} @ ${response.title.timecode}`)
		}

		// Native server format (flat timecode + command fields)
		if (!response.marker && !response.title && response.timecode) {
			if (response.command === 'create_marker') {
				this.self.setVariableValues({
					last_marker_timecode: response.timecode,
				})
			} else if (response.command === 'next_title') {
				this.self.setVariableValues({
					last_title_timecode: response.timecode,
				})
			}
		}
	}

	private onDisconnect(): void {
		this.stopPing()
		this.self.updateStatus(InstanceStatus.Disconnected)
		this.self.setVariableValues({ connection_status: 'Disconnected' })
		this.self.checkFeedbacks('connection_status')
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) return
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			this.connect()
		}, RECONNECT_INTERVAL)
	}

	private startPing(): void {
		this.stopPing()
		this.pingTimer = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.ping()
			}
		}, PING_INTERVAL)
	}

	private stopPing(): void {
		if (this.pingTimer) {
			clearInterval(this.pingTimer)
			this.pingTimer = null
		}
	}

	private cleanup(): void {
		this.stopPing()

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		if (this.ws) {
			this.ws.removeAllListeners()
			if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
				this.ws.close()
			}
			this.ws = null
		}
	}
}
