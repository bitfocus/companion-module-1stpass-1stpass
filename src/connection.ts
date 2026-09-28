import WebSocket from 'ws'
import { InstanceStatus } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { MAX_CAMERAS, type TallyCamera } from './tally.js'

const RECONNECT_INTERVAL = 5000
const PING_INTERVAL = 15000
// If no pong arrives within this window after a ping, treat the socket as half-open.
const PONG_TIMEOUT = PING_INTERVAL * 2
// Hard cap on a WebSocket handshake. ws does not enforce one by default.
const CONNECT_TIMEOUT = 10000
// How long to wait for the tally snapshot 1stPass sends on connect before
// deciding this is an older build that does not push state. Without this the
// symptom of a version mismatch is twenty permanently black buttons and no
// diagnostics at all.
const TALLY_SNAPSHOT_TIMEOUT = 3000

function wsDataToString(data: WebSocket.Data): string {
	if (typeof data === 'string') return data
	if (Array.isArray(data)) return Buffer.concat(data).toString('utf8')
	if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
	return data.toString('utf8')
}

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
	camera_name?: string
	error?: string
	message?: string
	// Camera body control (camera_focus / camera_step)
	camera?: number
	property?: string
	value?: string
	/** False when the app deliberately did nothing — no body bound to that
	 * camera, its current mode owns the property, the ladder is already at its
	 * end. Carried as a success precisely so it stays out of `last_error`. */
	applied?: boolean
	reason?: string
}

export class ConnectionManager {
	private ws: WebSocket | null = null
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private pingTimer: ReturnType<typeof setInterval> | null = null
	private connectTimer: ReturnType<typeof setTimeout> | null = null
	private tallyWatchTimer: ReturnType<typeof setTimeout> | null = null
	private lastPongAt = 0
	private intentionalClose = false
	private self: ModuleInstance

	constructor(self: ModuleInstance) {
		this.self = self
	}

	connect(): void {
		this.cleanup()
		this.intentionalClose = false

		const { host, port } = this.self.config
		const trimmedHost = (host ?? '').trim()
		const validPort = typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536

		if (!trimmedHost || !validPort) {
			const reason = !trimmedHost ? 'Host is empty' : `Port ${String(port)} is invalid`
			this.self.log('error', `${reason}; not connecting until config is fixed`)
			this.self.updateStatus(InstanceStatus.BadConfig, reason)
			this.self.setVariableValues({
				connection_status: 'Bad config',
				last_error: reason,
			})
			this.self.checkFeedbacks('connection_status')
			return
		}

		const url = `ws://${trimmedHost}:${port}`

		this.self.log('info', `Connecting to ${url}`)
		this.self.updateStatus(InstanceStatus.Connecting)

		try {
			this.ws = new WebSocket(url)
		} catch (err) {
			this.self.log('error', `Failed to create WebSocket: ${err instanceof Error ? err.message : String(err)}`)
			this.self.updateStatus(InstanceStatus.ConnectionFailure)
			this.scheduleReconnect()
			return
		}

		this.connectTimer = setTimeout(() => {
			this.connectTimer = null
			if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
				this.self.log('warn', `Connect timed out after ${CONNECT_TIMEOUT}ms; terminating and retrying`)
				this.ws.terminate()
			}
		}, CONNECT_TIMEOUT)

		this.ws.on('open', () => {
			if (this.connectTimer) {
				clearTimeout(this.connectTimer)
				this.connectTimer = null
			}
			this.self.log('info', 'Connected')
			this.self.updateStatus(InstanceStatus.Ok)
			this.self.setVariableValues({
				connection_status: 'Connected',
				last_error: '',
			})
			this.self.checkFeedbacks('connection_status')
			this.lastPongAt = Date.now()
			this.startPing()
			this.watchForTallyState()
		})

		this.ws.on('pong', () => {
			this.lastPongAt = Date.now()
		})

		this.ws.on('message', (data: WebSocket.Data) => {
			// Any inbound traffic proves the link is alive even if the peer's pong is delayed.
			this.lastPongAt = Date.now()
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
			this.self.setVariableValues({ last_error: err.message })
			// close event will fire after error, handling reconnect there
		})
	}

	disconnect(): void {
		this.intentionalClose = true
		this.cleanup()
	}

	send(data: Record<string, unknown>): boolean {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data))
			return true
		}
		const cmd = typeof data.command === 'string' ? data.command : 'command'
		const reason = `Not connected — dropped ${cmd}`
		this.self.log('warn', reason)
		this.self.setVariableValues({ last_error: reason })
		// Demote status so the operator's UI reflects that commands aren't reaching the app.
		this.self.updateStatus(
			this.ws && this.ws.readyState === WebSocket.CONNECTING ? InstanceStatus.Connecting : InstanceStatus.Disconnected,
			reason,
		)
		return false
	}

	get isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN
	}

	private handleMessage(data: WebSocket.Data): void {
		try {
			const msg = JSON.parse(wsDataToString(data))

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

			// Switcher state, pushed unsolicited whenever it changes and once on
			// connect. This is the only thing that drives the camera buttons.
			if (msg.type === 'tally_state' && Array.isArray(msg.cameras)) {
				this.handleTallyState(msg.cameras as TallyCamera[])
				return
			}

			// Handle direct response format (native server)
			if (msg.status) {
				this.processResponse(msg as ServerResponse)
				return
			}
		} catch (err) {
			this.self.log('warn', `Failed to parse message: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	private handleTallyState(cameras: TallyCamera[]): void {
		this.clearTallyWatch()
		this.self.tally.update(cameras)

		const values: Record<string, string> = {}
		for (let n = 1; n <= MAX_CAMERAS; n++) {
			const camera = this.self.tally.get(n)
			values[`camera_${n}_name`] = camera?.name ?? ''
			values[`camera_${n}_state`] = camera?.state ?? ''
		}
		// Also the authoritative writer for these two. They used to be set only
		// from a select_camera reply — i.e. only when Companion itself moved
		// preview — so cutting on the Mac left them quietly lying.
		values.program_camera = this.self.tally.find('program')?.name ?? ''
		values.standby_camera = this.self.tally.find('preview')?.name ?? ''

		this.self.setVariableValues(values)
		this.self.checkFeedbacks('camera_tally')
	}

	private watchForTallyState(): void {
		this.clearTallyWatch()
		this.tallyWatchTimer = setTimeout(() => {
			this.tallyWatchTimer = null
			if (this.self.tally.hasReceivedState) return
			this.self.log(
				'warn',
				'Connected, but 1stPass never sent tally state. Camera buttons will stay blank. ' +
					'This usually means 1stPass is older than this module — update the app.',
			)
		}, TALLY_SNAPSHOT_TIMEOUT)
	}

	private clearTallyWatch(): void {
		if (this.tallyWatchTimer) {
			clearTimeout(this.tallyWatchTimer)
			this.tallyWatchTimer = null
		}
	}

	private processResponse(response: ServerResponse): void {
		if (response.status === 'error') {
			const detail = response.message || response.error || 'Unknown error'
			this.self.log('warn', `Server error: ${detail}`)
			this.self.setVariableValues({ last_error: detail })
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

		// Camera body control. No timecode — nothing is recorded to the timeline,
		// a camera was moved — so this is answered before the timecode branches
		// below and reported only to the log. A skipped press is not an error and
		// must not reach `last_error`: on most rigs the majority of cameras have
		// no body bound to them at all.
		if (response.command === 'camera_focus' || response.command === 'camera_step') {
			const what = response.property ? `${response.command} (${response.property})` : response.command
			const which = response.camera === undefined ? '' : ` camera ${response.camera}`
			if (response.applied === false) {
				this.self.log('info', `${what}${which} did nothing: ${response.reason ?? 'no reason given'}`)
			} else if (response.value) {
				this.self.log('info', `${what}${which} → ${response.value}`)
			} else {
				this.self.log('info', `${what}${which} sent`)
			}
			return
		}

		// Native server format — select_camera (no timecode, has camera_name)
		if (response.command === 'select_camera') {
			if (response.camera_name) {
				this.self.setVariableValues({
					standby_camera: response.camera_name,
				})
				this.self.log('info', `Camera selected: ${response.camera_name}`)
			} else {
				this.self.log('warn', 'select_camera response missing camera_name; standby_camera not updated')
			}
			return
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
			} else if (response.command === 'camera_cut') {
				this.self.setVariableValues({
					last_cut_timecode: response.timecode,
				})
				this.self.log('info', `Camera cut recorded @ ${response.timecode}`)
			} else if (response.command === 'camera_fade') {
				this.self.setVariableValues({
					last_fade_timecode: response.timecode,
				})
				this.self.log('info', `Camera fade recorded @ ${response.timecode}`)
			}
		}
	}

	private onDisconnect(): void {
		this.stopPing()
		if (this.connectTimer) {
			clearTimeout(this.connectTimer)
			this.connectTimer = null
		}
		this.clearTallyWatch()
		this.self.updateStatus(InstanceStatus.Disconnected)

		// Forget the switcher state rather than freezing on it. The show carries
		// on without us, so a button still glowing red is a lie — and a tally
		// that lies is worse than one that is plainly dark.
		this.self.tally.clear()
		const cleared: Record<string, string> = { connection_status: 'Disconnected' }
		for (let n = 1; n <= MAX_CAMERAS; n++) {
			cleared[`camera_${n}_name`] = ''
			cleared[`camera_${n}_state`] = ''
		}
		cleared.program_camera = ''
		cleared.standby_camera = ''
		this.self.setVariableValues(cleared)
		this.self.checkFeedbacks('connection_status', 'camera_tally')
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
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

			const sincePong = Date.now() - this.lastPongAt
			if (sincePong > PONG_TIMEOUT) {
				this.self.log('warn', `No pong for ${sincePong}ms (>${PONG_TIMEOUT}ms); terminating half-open socket`)
				this.ws.terminate()
				return
			}
			this.ws.ping()
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
		this.clearTallyWatch()

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		if (this.connectTimer) {
			clearTimeout(this.connectTimer)
			this.connectTimer = null
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
