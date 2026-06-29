/**
 * shared confirmation dialog
 *
 * @param {string} [content]  Optional custom message (defaults to a generic one).
 * @returns {Promise<boolean>} true if the user confirmed.
 */
export async function confirmDeletion(content) {
    return foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("MIST_ENGINE.QUESTIONS.ConfirmDeletionTitle") },
        content: content ?? game.i18n.localize("MIST_ENGINE.QUESTIONS.ConfirmDeletion"),
        rejectClose: false,
        modal: true
    });
}
