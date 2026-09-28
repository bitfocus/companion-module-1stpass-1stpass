import type {
	CompanionMigrationFeedback,
	CompanionUpgradeContext,
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
} from '@companion-module/base'
import type { ModuleConfig } from './config.js'

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig>[] = [
	/**
	 * `camera_tally` became `camera_tally_name`.
	 *
	 * The feedback always did two things — colored the button and labeled it
	 * from the camera name — and the old id only said one of them, which is
	 * misleading now that there are camera actions alongside it and may well be
	 * ambiguous once there is a second per-camera feedback.
	 *
	 * Renaming a feedback id orphans it on every button already using it, so
	 * this rewrites them on load rather than leaving anyone to re-add their
	 * buttons by hand. The options are unchanged, so only the id moves.
	 */
	function renameCameraTallyFeedback(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig>,
	): CompanionStaticUpgradeResult<ModuleConfig> {
		const updatedFeedbacks: CompanionMigrationFeedback[] = []

		for (const feedback of props.feedbacks) {
			if (feedback.feedbackId === 'camera_tally') {
				feedback.feedbackId = 'camera_tally_name'
				updatedFeedbacks.push(feedback)
			}
		}

		return {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks,
		}
	},
]
