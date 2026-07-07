/**
 * Custom journal entry sheet.
 * @extends {foundry.applications.sheets.journal.JournalEntrySheet}
 */
export class MistEngineJournalEntrySheet extends foundry.applications.sheets.journal.JournalEntrySheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    position: {
      width: 1200,
    },
  };
}
