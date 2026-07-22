const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
import { MistSceneApp } from "./scene-app.mjs";
import { FloatingTagAndStatusAdapter } from "../lib/floating-tag-and-status-adapter.mjs";
import { PowerTagAdapter } from "../lib/power-tag-adapter.mjs";
import { StoryTagAdapter } from "../lib/story-tag-adapter.mjs";
import { RollConfirmation } from "../lib/roll-confirmation.mjs";
import { ArrayFieldAdapter } from "../lib/array-field-adapter.mjs";
import * as DetailedSpend from "../lib/detailed-spend.mjs";
import { Collaboration } from "../lib/collaboration.mjs";

export class DiceRollApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.actor = options.actor;
        this.rollType = options.type || 'quick'; // 'quick' or 'detailed'

        //both are { name: String, positive: Boolean, weakness: Boolean, source: String,value: Number }
        this.selectedTags = [];
        this.selectedGmTags = [];
        this.selectedStoryTags = [];
        this.challengeTags = [];
        this.numModPositive = 0;
        this.numModNegative = 0;
        this.mightScale = 0;

        // pending GM confirmation: { requestId, formValues, snapshot } or null
        this.pendingRequest = null;

        // Helping Each Other (p. 131): tags other heroes contribute to this roll.
        // Each { name, helperName } adds +1 Power and cannot be burned.
        this.helpingTags = [];
        this.pendingHelpReqId = null;

        // Per-roll tag inversion (#35, Narrator discretion, Core Book): a Weakness
        // may count as Power and a Power tag as Weakness, for this roll only.
        // In-memory only, never persisted to the actor: a Set of tagKey
        // strings (see getTagKey), re-applied to freshly derived tags in
        // prepareTags() and cleared on roll execution, actor change and close.
        this.invertedTags = new Set();

        // Per-roll Challenge/Scene-Story polarity inversion (#104): lets a positive
        // challenge status (e.g. swift-4) be applied AGAINST the roll as -4 without
        // editing the challenge (or scene) document. In-memory only: a Set of
        // challengeEntryKey strings (see getChallengeEntryKey), re-applied to
        // freshly derived entries in prepareChallengeTags()/prepareSceneAndStoryTags()
        // and cleared on roll execution, actor change and close (same lifecycle as
        // invertedTags above).
        this.invertedChallengeEntries = new Set();

        DiceRollApp.instance = this;
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        id: 'dice-roll-app',
        classes: ['mist-engine', 'dialog', 'dice-roll-app'],
        tag: 'div',
        window: {
            frame: true,
            title: 'Dice Roll',
            icon: 'fa-solid fa-book-atlas',
            positioned: true,
            resizable: true
        },
        position: {
            width: 400,
            height: 600
        },
        actions: {
            clickedRoll: this.#rollCallback,
            clickModPositiveMinus: this.#handleClickModPositiveMinus,
            clickModPositivePlus: this.#handleClickModPositivePlus,
            clickModNegativeMinus: this.#handleClickModNegativeMinus,
            clickModNegativePlus: this.#handleClickModNegativePlus,
            clickDeselectTag: this.#handleClickDeselectTag,
            clickTagStatusModifierToggle: this.#handleTagStatusModifierToggle,
            clickCancelConfirmation: this.#handleClickCancelConfirmation,
            clickRequestHelp: this.#handleRequestHelp,
            clickRemoveHelpingTag: this.#handleRemoveHelpingTag,
            clickToggleTagInversion: this.#handleToggleTagInversion,
            clickToggleChallengeInversion: this.#handleToggleChallengeInversion
        },
    };

    /** @override */
    static PARTS = {
        dialog: {
            template: 'systems/mist-engine-fvtt/templates/dice-roll-app/dialog.hbs',
            scrollable: ['']
        }
    };

    setOptions(options) {
        if (options.actor) {
            // a per-roll tag/Challenge inversion is scoped to the actor it was
            // granted for; switching actors on this (singleton) dialog must not carry it over
            if (this.actor?.id !== options.actor.id) {
                this.invertedTags.clear();
                this.invertedChallengeEntries.clear();
            }
            this.actor = options.actor;
        }
        if (options.type) {
            this.rollType = options.type || 'quick'; // 'quick' or 'detailed'
        }

        // set the dialog title according to the type
        if (this.rollType === 'quick') {
            this.options.window.title = 'Quick Dice Roll';
        } else if (this.rollType === 'detailed') {
            this.options.window.title = 'Detailed Dice Roll';
        }
        else if (this.rollType === 'reaction') {
            this.options.window.title = 'Reaction Roll';
        }
    }

    updateTagsAndStatuses(renderFlag = false) {
        this.selectedTags = [];
        this.selectedGmTags = [];
        this.selectedStoryTags = [];
        this.challengeTags = [];

        this.prepareTags();
        this.prepareGMTags();
        this.prepareSceneAndStoryTags();
        this.prepareChallengeTags();
        this.pruneInvertedChallengeEntries(); // #104: drop keys this pass didn't re-derive
        if (renderFlag == true && this.rendered) {
            this.render(true, { focus: true })
        }
    }

    /**
     * #104: after every re-derivation, drop any invertedChallengeEntries key
     * that wasn't matched by a currently-derived challenge/scene-story entry
     * THIS pass. An entry that's still present keeps its inversion (an
     * unrelated toggle elsewhere must not reset a live inversion — same
     * guarantee #35 gives Weakness inversion); an entry that's vanished loses
     * its key so it can never resurrect on a later derivation. This is what
     * actually fixes:
     *  - a GM deleting/editing the underlying tag/status while the dialog is
     *    open (an index shift must not silently invert whatever slides into
     *    that now-stale slot — the strengthened key in getChallengeEntryKey is
     *    a second line of defense for the same problem, this is the primary
     *    fix);
     *  - deselect-then-reselect resurrection (deselecting drops the entry from
     *    this pass entirely, since prepareChallengeTags/prepareSceneAndStoryTags
     *    only include `selected` entries — its key gets pruned here, so
     *    reselecting later derives it fresh, not inverted);
     *  - a scene switch leaving a stale key that could otherwise collide with
     *    the new scene's array at the same index.
     * Deliberately scoped to challenge/scene-story entries only — NOT applied
     * to invertedTags (#35), which is a separate, already-shipped branch;
     * see the PR draft/report for why the same latent issue there is left as a
     * follow-up rather than fixed on this branch.
     */
    pruneInvertedChallengeEntries() {
        const liveKeys = new Set([
            ...this.challengeTags.map(t => t.challengeEntryKey).filter(Boolean),
            ...this.selectedStoryTags.map(t => t.challengeEntryKey).filter(Boolean)
        ]);
        for (const key of Array.from(this.invertedChallengeEntries)) {
            if (!liveKeys.has(key)) this.invertedChallengeEntries.delete(key);
        }
    }

    static getInstance(options = {}) {
        if (!DiceRollApp.instance) {
            DiceRollApp.instance = new DiceRollApp(options);
        }
        let instance = DiceRollApp.instance;
        instance.setOptions(options);
        return instance;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        this.applyRulesPreviewToSelectedTags();
        context.selectedTags = this.selectedTags;
        context.selectedGmTags = this.selectedGmTags;
        context.selectedStoryTags = this.selectedStoryTags;
        context.challengeTags = this.challengeTags;
        context.rollType = this.rollType;
        context.numModPositive = this.numModPositive || 0;
        context.numModNegative = this.numModNegative || 0;
        context.mightScale = this.mightScale;
        context.mightUsageEnabled = game.settings.get("mist-engine-fvtt", "mightUsageEnabled");
        if (context.mightUsageEnabled == false) { // just to be sure
            context.mightScale = 0;
        }
        context.powerAmount = this.computePowerAmount();
        context.waitingForGm = !!this.pendingRequest;
        // Helping Each Other: contributed tags + whether a Request Help button applies
        context.helpingTags = this.helpingTags;
        context.canRequestHelp = !this.pendingRequest && Collaboration.hasOtherPlayers();
        /*if(context.powerAmount < 0){
            context.powerAmount = 0;
        }*/

        // sort selected tags by first positive ones then negative ones, both alphabetically
        context.selectedTags.sort((a, b) => {
            if (a.positive === b.positive) {
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });

        // sort select gm tags by first positive ones then negative ones, both alphabetically
        context.selectedGmTags.sort((a, b) => {
            if (a.positive === b.positive) {
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });

        // sort select story tags by first positive ones then negative ones, both alphabetically
        context.selectedStoryTags.sort((a, b) => {
            if (a.positive === b.positive) {
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });

        // sort challenge tags
        context.challengeTags.sort((a, b) => {
            if (a.positive === b.positive) {
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });
        return context;
    }

    /** Total power shown in the dialog: tags +/- , might scale and the manul +/- mods. */
    computePowerAmount() {
        const countTags = DiceRollApp.calculatePowerTags(
            DiceRollApp.applyRulesToSelectedTags(this.selectedTags, this.selectedGmTags, this.selectedStoryTags, this.challengeTags)
        );
        const mightEnabled = game.settings.get("mist-engine-fvtt", "mightUsageEnabled") === true;
        const mightScale = mightEnabled ? (this.mightScale || 0) : 0;
        const helping = (this.helpingTags?.length || 0); // +1 per helping tag (p. 131)
        const power = (countTags.positive - countTags.negative) + mightScale + helping + (this.numModPositive || 0) - (this.numModNegative || 0);
        return Math.max(1, power); // preview matches the roll: never below Power 1 (see executeRoll)
    }

    /** @inheritDoc */
    _onRender(context, options) {
        super._onRender(context, options);

        const updatePowerLabel = () => {
            const label = this.element.querySelector('.power-label');
            if (label) label.textContent = `Power: ${this.computePowerAmount()}`;
        };

        const posInput = this.element.querySelector('#positiveInput');
        posInput?.addEventListener('input', () => {
            this.numModPositive = Math.max(0, parseInt(posInput.value) || 0);
            updatePowerLabel();
        });

        const negInput = this.element.querySelector('#negativeInput');
        negInput?.addEventListener('input', () => {
            this.numModNegative = Math.max(0, parseInt(negInput.value) || 0);
            updatePowerLabel();
        });

        for (const radio of this.element.querySelectorAll('.might-scale-radio')) {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.mightScale = parseInt(radio.value) || 0;
                    updatePowerLabel();
                }
            });
        }
    }

    prepareGMTags() {
        const sceneApp = MistSceneApp.instance;
        if (!sceneApp) return;
        sceneApp.getRollModifications().forEach(element => {
            // at present all gm tags are negative
            // the roll modifications have a flag positive(boolean) but it is not used for now
            this.selectedGmTags.push({ name: element.name, positive: element.positive, source: "gm", value: element.value, might: element.might, mightIcon: element.mightIcon });
        });
    }

    prepareSceneAndStoryTags() {
        const sceneApp = MistSceneApp.instance;
        if (!sceneApp) return;
        sceneApp.getSceneAndStoryTags().forEach((element, index) => {
            if (element.selected) {
                let t = { name: element.name, positive: element.positive, source: "scene-and-story", value: element.value, index, sceneDataItemId: sceneApp.currentSceneDataItem?.id, might: element.might, mightIcon: element.mightIcon };
                // #104: only scene/story STATUSES (value > 0) can be inverted for this
                // roll — a plain scene/story tag has no "count against instead" reading.
                if (element.value > 0) {
                    DiceRollApp.applyChallengeInversion(t, this.invertedChallengeEntries);
                }
                this.selectedStoryTags.push(t);
            }
        });
    }

    prepareChallengeTags() {
        const sceneApp = MistSceneApp.instance;
        if (!sceneApp) return;
        sceneApp.getCombinedSelectedNPCTags().forEach(element => {
            if (element.selected) {
                let t = { name: element.name, positive: element.positive, source: "npc", value: element.value, actorId: element.actorId, index: element.index, might: element.might, mightIcon: element.mightIcon };
                // #104: a challenge's status/tag can be applied against the roll for
                // this roll only, without editing the challenge document.
                DiceRollApp.applyChallengeInversion(t, this.invertedChallengeEntries);
                this.challengeTags.push(t);
            }
        });
    }

    static calculatePowerTags(tagsForRoll) {
        let numPositiveTags = 0;
        let numNegativeTags = 0;
        let burnUsed = false; // only one tag may burn for +3 (#92)

        tagsForRoll.forEach(element => {
            // #35: per-roll inversions are already baked into `positive` by
            // prepareTags(), so no special-casing is needed here.

            if (element.value === undefined || element.value == 0) {
                if (element.positive) {
                    if (element.toBurn && !burnUsed) {
                        numPositiveTags += 3;
                        burnUsed = true;
                    } else {
                        numPositiveTags += 1;
                    }
                }
                else {
                    numNegativeTags++;
                }
            } else {
                // statuses
                if (element.positive) {
                    numPositiveTags += element.value;
                }
                else {
                    numNegativeTags += element.value;
                }
            }
        });
        return { positive: numPositiveTags, negative: numNegativeTags };
    }

    applyRulesPreviewToSelectedTags() {
        const tempTagsForRole = DiceRollApp.applyRulesToSelectedTags(this.selectedTags, this.selectedGmTags, this.selectedStoryTags, this.challengeTags);
        // we got the result, now we add to the single selectedTags array a new property 'isAppliedInPreview' to indicate if the tag/status is applied in the preview
        this.selectedTags.forEach(tag => {
            const foundTag = tempTagsForRole.find(t => t.name === tag.name && t.positive === tag.positive && t.source === tag.source);
            if (foundTag) {
                tag.isAppliedInPreview = true;
            } else {
                tag.isAppliedInPreview = false;
            }
        });

        // we do the same for selectedGmTags
        this.selectedGmTags.forEach(tag => {
            const foundTag = tempTagsForRole.find(t => t.name === tag.name && t.positive === tag.positive && t.source === tag.source);
            if (foundTag) {
                tag.isAppliedInPreview = true;
            } else {
                tag.isAppliedInPreview = false;
            }
        });

        // the same for selectedStoryTags
        this.selectedStoryTags.forEach(tag => {
            const foundTag = tempTagsForRole.find(t => t.name === tag.name && t.positive === tag.positive && t.source === tag.source);
            if (foundTag) {
                tag.isAppliedInPreview = true;
            } else {
                tag.isAppliedInPreview = false;
            }
        });

        // the same for challengeTags
        this.challengeTags.forEach(tag => {
            const foundTag = tempTagsForRole.find(t => t.name === tag.name && t.positive === tag.positive && t.source === tag.source && t.actorId === tag.actorId);
            if (foundTag) {
                tag.isAppliedInPreview = true;
            } else {
                tag.isAppliedInPreview = false;
            }
        });
    }

    static applyRulesToSelectedTags(selectedTags, selectedGmTags, selectedStoryTags, selectedChallengeTags) {
        const tagsForRole = [];

        // first the take all normal tags
        selectedGmTags.forEach(gmTag => {
            if (gmTag.value === 0 || gmTag.value === undefined) {
                tagsForRole.push(gmTag);
            }
        });

        selectedTags.forEach(tag => {
            if (tag.value === 0 || tag.value === undefined) {
                tagsForRole.push(tag);
            }
        });

        selectedStoryTags.forEach(tag => {
            if (tag.value === 0 || tag.value === undefined) {
                tagsForRole.push(tag);
            }
        });

        selectedChallengeTags.forEach(tag => {
            if (tag.value === 0 || tag.value === undefined) {
                tagsForRole.push(tag);
            }
        });

        let statuses = selectedTags.filter(t => t.value && t.value > 0);
        statuses = selectedStoryTags.filter(t => t.value && t.value > 0).concat(statuses);
        statuses = selectedGmTags.filter(t => t.value && t.value > 0).concat(statuses);
        statuses = selectedChallengeTags.filter(t => t.value && t.value > 0).concat(statuses);

        let positiveStatuses = statuses.filter(s => s.positive);
        let negativeStatuses = statuses.filter(s => !s.positive);

        // lets go through the statuses, but we only take the highest value one for each type
        if (positiveStatuses.length > 0) {
            let biggestPositiveStatus = positiveStatuses.reduce(function (prev, current) {
                return (prev && prev.value > current.value) ? prev : current
            }) //returns object
            if (biggestPositiveStatus) {
                tagsForRole.push(biggestPositiveStatus);
            }
        }


        if (negativeStatuses.length > 0) {
            let biggestNegativeStatus = negativeStatuses.reduce(function (prev, current) {
                return (prev && prev.value > current.value) ? prev : current
            }) //returns object
            if (biggestNegativeStatus) {
                tagsForRole.push(biggestNegativeStatus);
            }
        }

        return tagsForRole;
    }

    /**
     * Stable identity for an invertible tag entry (Power or Weakness), used as
     * the key for the per-roll `invertedTags` Set (#35). Themebook tags are keyed
     * by their themebook item id + tag index; the fellowship themecard has no
     * themebookId, so its `source` stands in for it. Power and weakness indices
     * overlap, so the tag kind is part of the key. Both index schemes are
     * 0-based per-item indices assigned in getPreparedTagsAndStatusesForRoll.
     */
    static getTagKey(tag) {
        return `${tag.themebookId ?? tag.source ?? "na"}:${tag.weakness ? "w" : "p"}:${tag.index}`;
    }

    /**
     * Stable-ish identity for a Challenge/Scene-Story entry, used as the key for
     * the per-roll `invertedChallengeEntries` Set (#104). NPC challenge entries
     * are keyed by actor id + their index within that actor's
     * floatingTagsAndStatuses (see MistSceneApp.getCombinedSelectedNPCTags);
     * scene/story entries are keyed by the scene data item's own id (via
     * `sceneDataItemId`, so a scene switch never collides with a different
     * scene's array at the same index) + their index within it (see
     * prepareSceneAndStoryTags).
     *
     * The NAME is included as a defense-in-depth measure, not the primary
     * identity: index alone is only stable while the underlying array doesn't
     * shift. If the GM deletes an earlier entry while the dialog is open, a
     * later entry can slide into a stale index — including the name means that
     * shift changes the key too, so the stale key matches nothing (the
     * inversion is silently lost) rather than silently reattaching to the
     * wrong entry (wrong roll math). Same-named entries on the same owner stay
     * distinct via index. This is belt-and-suspenders: prepareChallengeTags()/
     * prepareSceneAndStoryTags() also prune any key that goes unmatched after
     * every derivation (see pruneInvertedChallengeEntries), which is the actual
     * fix for the deletion-shift and deselect/reselect-resurrection cases.
     */
    static getChallengeEntryKey(entry) {
        const ownerId = entry.actorId ?? entry.sceneDataItemId ?? "na";
        return `${entry.source ?? "na"}:${ownerId}:${entry.index}:${entry.name ?? ""}`;
    }

    /**
     * #104: apply a pending per-roll inversion to a freshly built Challenge/Scene-
     * Story entry — flips its polarity so it competes in the opposite bucket in
     * applyRulesToSelectedTags (e.g. a positive swift-4 status becomes a -4
     * negative status), without touching the persisted document. Mutates `entry`
     * in place and stamps `challengeEntryKey` on it either way, so the dialog
     * template always has a key to toggle against.
     */
    static applyChallengeInversion(entry, invertedChallengeEntries) {
        entry.challengeEntryKey = DiceRollApp.getChallengeEntryKey(entry);
        if (invertedChallengeEntries.has(entry.challengeEntryKey)) {
            entry.positive = !entry.positive;
            entry.challengeInverted = true;
        }
    }

    static getPreparedTagsAndStatusesForRoll(actor) {
        let selectedTags = [];
        if (!actor || (actor.type !== "character" && actor.type !== "litm-character")) {
            return selectedTags;
        }

        if (!actor) {
            console.warn("No actor provided for getPreparedTagsAndStatusesForRoll");
            return selectedTags;

        }
        for (let item of actor.items) {
            if (item.type === "backpack") {
                const backpackItems = item.system.items;
                if (backpackItems) {
                    for (const [i, backpackItem] of backpackItems.entries()) {
                        if (backpackItem.selected && !backpackItem.expired) {
                            selectedTags.push({ name: backpackItem.name, positive: true, toBurn: backpackItem.toBurn, index: i + 1, themebookId: backpackItem.id, source: 'backpack' });
                        }
                    }
                }
            }

            if (item.type === "rote" && item.system.selected) {
                // a rote's title works as a tag (Core Book p. 98)
                selectedTags.push({ name: item.name, positive: true, source: "rote", roteId: item.id });
            }

            if (item.type === "themebook") {
                if(item.system.powertags){
                    item.system.powertags.forEach((tag, i) => {
                        if (tag.selected) {
                            selectedTags.push({ name: tag.name, positive: true, powerTag: true, toBurn: tag.toBurn, index: i, themebookId: item.id, source: null });
                        }
                    });
                }
                if(item.system.weaknesstags){
                    item.system.weaknesstags.forEach((tag, i) => {
                        if (tag.selected) {
                            selectedTags.push({ name: tag.name, positive: false, weakness: true, index: i, themebookId: item.id, source: null });
                        }
                    });
                }
            }
        }

        if (actor.system.fellowships && actor.system.fellowships.length > 0) {
            actor.system.fellowships.forEach((entry, index) => {
                if (entry.selected) {
                    selectedTags.push({ name: entry.relationshipTag, positive: true, fellowship: true, source: 'fellowship-relationship', index: index + 1 });
                }
            });
        }

        // fellowship themecard tags
        if (actor.sheet.getActorFellowshipThemecard()) {
            let actorFellowshipThemecard = actor.sheet.getActorFellowshipThemecard();
            if (actorFellowshipThemecard) {
                // check if ther are any powertags
                if (actorFellowshipThemecard.system.powertags) {
                    actorFellowshipThemecard.system.powertags.forEach((tag, i) => {
                        if (tag.selected) {
                            selectedTags.push({ name: tag.name, positive: true, powerTag: true, toBurn: tag.toBurn, index: i, source: "fellowship-themecard" });
                        }
                    });
                }

                if (actorFellowshipThemecard.system.weaknesstags) {
                    actorFellowshipThemecard.system.weaknesstags.forEach((tag, i) => {
                        if (tag.selected) {
                            selectedTags.push({ name: tag.name, positive: false, weakness: true, index: i, source: "fellowship-themecard" });
                        }
                    });
                }
            }
        } else {
            console.log("No fellowship themecard in the actor getActorFellowshipThemecard():", actor.name);
        }

        // floating tags and statuses from the actor
        if (actor.system.floatingTagsAndStatuses && actor.system.floatingTagsAndStatuses.length > 0) {
            actor.system.floatingTagsAndStatuses.forEach((entry, index) => {
                if (entry.selected) {
                    let t = { name: entry.name, positive: entry.positive, source: "floating-tag", value: entry.value,index: index + 1,isStatus: entry.isStatus, might: entry.might, mightIcon: entry.mightIcon, isClickable: true };
                    if(entry.value === undefined || entry.value > 0){
                        t.isStatus = true;
                    }
                    selectedTags.push(t);
                }
            });
        }

        // sort selected tags by first positive ones then negative ones, both alphabetically
        selectedTags.sort((a, b) => {
            if (a.positive === b.positive) {
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });

        return selectedTags;
    }

    prepareTags() {

        this.selectedTags = DiceRollApp.getPreparedTagsAndStatusesForRoll(this.actor);

        // re-apply any per-roll tag inversion (#35): this array is rebuilt from
        // the persisted documents on every call, so the in-memory invertedTags
        // Set is the only thing that survives a re-derivation. An inverted tag
        // simply flips `positive` — the roll math, chat grouping and the
        // colour/thumb rendering all follow from that one flag; `inverted`
        // only drives the visual "this was flipped" marker.
        this.selectedTags.forEach(tag => {
            if (tag.weakness || tag.powerTag) {
                tag.tagKey = DiceRollApp.getTagKey(tag);
                // burn wins over a stale inversion: the toggle refuses burning
                // tags, but the tag can be marked to burn on the sheet while
                // the dialog is open — it would then be spent for a penalty
                tag.inverted = this.invertedTags.has(tag.tagKey) && !tag.toBurn;
                if (tag.inverted) {
                    tag.positive = !tag.positive;
                }
            }
        });

        // an inversion changes polarity after the initial sort — restore the
        // positive-first, alphabetical order the dialog relies on
        this.selectedTags.sort((a, b) => {
            if (a.positive === b.positive) {
                return a.name.localeCompare(b.name);
            }
            return a.positive ? -1 : 1;
        });

    }

    // ToDo, Needs fixing, not working as expected
    isTagToBurn(index, themebookId, source = null) {
        for (let tag of this.selectedTags) {
            if (tag.toBurn && tag.index === index && themebookId === tag.themebookId && source === null) {
                return true;
            }
            else if (tag.toBurn && tag.index === index && source !== null) {
                if (tag.source === source) {
                    return true;
                }
            }
        }
        return false;
    }

    wasTagSelected(index, themebookId, source = null) {
        for (let tag of this.selectedTags) {
            if (tag.index === index && themebookId === tag.themebookId && source === null) {
                return true;
            }
            else if (tag.index === index && source !== null) {
                if (tag.source === source) {
                    return true;
                }
            }
        }
        return false;
    }

    async resetTags() {
        let alreadyImprovedThemebooks = [];
        let burnedOne = false; // at most one tag may actually burn per roll (#92)

        for (let item of this.actor.items) {
            if (item.type === "rote" && item.system.selected) {
                await item.update({ "system.selected": false });
            }
            if (item.type === "backpack") {
                const backpackItems = item.system.items;
                if (backpackItems) {
                    for (let [bi, backpackItem] of backpackItems.entries()) {
                        backpackItem.selected = false;
                        if (backpackItem.toBurn) {
                            if (!burnedOne) {
                                backpackItem.burned = true;
                                burnedOne = true;
                            }
                            backpackItem.toBurn = false;
                        }
                    }
                }

                await item.update({ 'system.items': backpackItems });
            }
            if (item.type === "themebook") {
                if (item.system.powertags && item.system.powertags.length > 0) {
                    const powertags = item.system.powertags.map((tag, i) => {
                        let burned = tag.burned;
                        if (!burned && !burnedOne && this.isTagToBurn(i, item._id)) {
                            burned = true;
                            burnedOne = true;
                        }
                        return { ...tag, selected: false, toBurn: false, burned };
                    });
                    await item.update({ 'system.powertags': powertags });
                }

                // improvement is earned by invoking a tag from this themebook as
                // hindering (#35): a Weakness used straight, or a Power tag
                // inverted to count as Weakness for this roll. A Weakness
                // inverted to help earns nothing. selectedTags carries the
                // effective (post-inversion) polarity in `positive`.
                const invokedAsHindering = this.selectedTags.some(t =>
                    t.themebookId === item.id && (t.weakness || t.powerTag) && !t.positive);
                if (invokedAsHindering && item.system.improve < 3 && !alreadyImprovedThemebooks.includes(item.id)) {
                    alreadyImprovedThemebooks.push(item.id);
                    await item.update({ 'system.improve': item.system.improve + 1 });
                }

                if (item.system.weaknesstags && item.system.weaknesstags.length > 0) {
                    const weaknesstags = item.system.weaknesstags.map(tag => ({ ...tag, selected: false }));
                    await item.update({ 'system.weaknesstags': weaknesstags });
                }



            }
        }

        const fellowships = this.actor.system.fellowships;
        let fellowshipTagsToCheck = this.selectedTags.filter(t => t.source === "fellowship-relationship").map(t => t.name);
        if (fellowships && fellowships.length > 0) {
            fellowships.forEach((entry) => {
                //check if fellowship tag was selected
                if (fellowshipTagsToCheck.includes(entry.relationshipTag)) {
                    // mark as scratched
                    if (entry.selected) {
                        entry.scratched = true;
                    }
                }
                entry.selected = false;
            });
            await this.actor.update({ 'system.fellowships': fellowships });
        }

        // fellowship themecard tags
        if (this.actor.sheet.getActorFellowshipThemecard()) {
            let actorFellowshipThemecard = this.actor.sheet.getActorFellowshipThemecard();
            if (actorFellowshipThemecard) {

                if (actorFellowshipThemecard.system.powertags) {
                    const powertags = actorFellowshipThemecard.system.powertags.map((tag, i) => {
                        let burned = tag.burned;
                        if (!burned && !burnedOne && tag.toBurn) {
                            burned = true;
                            burnedOne = true;
                        }
                        return { ...tag, selected: false, toBurn: false, burned };
                    });
                    await actorFellowshipThemecard.update({ 'system.powertags': powertags });
                }

                // same hindering-earns-improvement rule as themebooks (#35)
                const themecardInvokedAsHindering = this.selectedTags.some(t =>
                    t.source === "fellowship-themecard" && (t.weakness || t.powerTag) && !t.positive);
                if (themecardInvokedAsHindering && actorFellowshipThemecard.system.improve < 3 && !alreadyImprovedThemebooks.includes(actorFellowshipThemecard.id)) {
                    alreadyImprovedThemebooks.push(actorFellowshipThemecard.id);
                    await actorFellowshipThemecard.update({ 'system.improve': actorFellowshipThemecard.system.improve + 1 });
                }

                if (actorFellowshipThemecard.system.weaknesstags) {
                    const weaknesstags = actorFellowshipThemecard.system.weaknesstags.map(tag => ({ ...tag, selected: false }));
                    await actorFellowshipThemecard.update({ 'system.weaknesstags': weaknesstags });
                }



            }
            if (this.actor.sheet) {
                this.actor.sheet.reloadFellowshipThemecard(true); // true for emitting data to others    
            } else {
                console.log("No actor sheet to send reload signal for fellowship themecard");
            }

        }

        // floating tags and statuses from the actor
        if (this.actor.system.floatingTagsAndStatuses && this.actor.system.floatingTagsAndStatuses.length > 0) {
            let floatingTagsAndStatuses = this.actor.system.floatingTagsAndStatuses;
            floatingTagsAndStatuses.forEach((entry) => {
                entry.selected = false;
            });
            await this.actor.update({ 'system.floatingTagsAndStatuses': floatingTagsAndStatuses });
        }

        this.actor.sheet.render();
        MistSceneApp.instance?.resetSelection();
    }

    static async #rollCallback(event, target) {
        if (this.pendingRequest) return; // already waiting for the GM

        const formValues = {
            numModPositive: parseInt(target.form.positiveValue.value) || 0,
            numModNegative: parseInt(target.form.negativeValue.value) || 0,
            mightScale: 0
        };

        // first check if might usage is enabled
        if (game.settings.get("mist-engine-fvtt", "mightUsageEnabled") == true) {
            formValues.mightScale = parseInt(target.form.might_scale.value) || 0;
        }

        if (RollConfirmation.needsConfirmation()) {
            this.requestGmConfirmation(formValues);
            return;
        }

        await this.executeRoll(formValues);
    }

    /** Send the roll to the GM for confirmation and lock the dialog until the answer arrives. */
    requestGmConfirmation(formValues) {
        const requestId = RollConfirmation.sendRequest(this, formValues);
        this.pendingRequest = {
            requestId,
            formValues,
            // roll exactly what the GM gets to see, even if the sheet changes meanwhile
            snapshot: {
                selectedTags: foundry.utils.deepClone(this.selectedTags),
                selectedGmTags: foundry.utils.deepClone(this.selectedGmTags),
                selectedStoryTags: foundry.utils.deepClone(this.selectedStoryTags),
                challengeTags: foundry.utils.deepClone(this.challengeTags)
            }
        };
        ui.notifications.info(game.i18n.localize("MIST_ENGINE.GM_CONFIRM.WaitingForGm"));
        this.render();
    }

    /** Player side: the GM answered our pending confirmation request. */
    handleConfirmationResponse(msg) {
        if (!this.pendingRequest || msg.requestId !== this.pendingRequest.requestId) return;
        const pending = this.pendingRequest;
        this.pendingRequest = null;

        if (msg.approved) {
            this.selectedTags = pending.snapshot.selectedTags;
            this.selectedGmTags = pending.snapshot.selectedGmTags;
            this.selectedStoryTags = pending.snapshot.selectedStoryTags;
            this.challengeTags = pending.snapshot.challengeTags;
            this.executeRoll(pending.formValues);
        } else {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.GM_CONFIRM.Rejected"));
            if (this.rendered) this.render();
        }
    }

    /** Withdraw a pending confirmation request (cancel button or dialog close). */
    cancelPendingRequest() {
        if (!this.pendingRequest) return;
        RollConfirmation.sendCancel(this.pendingRequest.requestId);
        this.pendingRequest = null;
    }

    static async #handleClickCancelConfirmation(event, target) {
        this.cancelPendingRequest();
        this.render();
    }

    /** @inheritDoc */
    _onClose(options) {
        super._onClose(options);
        this.cancelPendingRequest();
        if (this.pendingHelpReqId) { Collaboration.cancelHelp(this.pendingHelpReqId); this.pendingHelpReqId = null; }
        this.helpingTags = [];
        this.invertedTags.clear(); // #35: per-roll only, never carries into the next opening
        this.invertedChallengeEntries.clear(); // #104: per-roll only, never carries into the next opening
    }

    /** Socket callback: a fellow hero contributed a helping tag to this roll. */
    addHelpingTag({ helperName, tagName }) {
        this.helpingTags.push({ name: tagName, helperName });
        ui.notifications.info(game.i18n.format("MIST_ENGINE.COLLAB.HelpReceived", { helper: helperName, tag: tagName }));
        if (this.rendered) this.render();
    }

    static async #handleRequestHelp(event, target) {
        Collaboration.requestHelp(this);
    }

    static async #handleRemoveHelpingTag(event, target) {
        const idx = parseInt(target.dataset.index);
        if (idx >= 0 && idx < this.helpingTags.length) {
            this.helpingTags.splice(idx, 1);
            this.render();
        }
    }

    async executeRoll({ numModPositive, numModNegative, mightScale }) {
        let numPositiveTags = numModPositive;
        let numNegativeTags = numModNegative;

        let tagsAndStatusForRoll = DiceRollApp.applyRulesToSelectedTags(this.selectedTags, this.selectedGmTags, this.selectedStoryTags, this.challengeTags);
        let countTags = DiceRollApp.calculatePowerTags(tagsAndStatusForRoll);
        numPositiveTags += countTags.positive;
        numNegativeTags += countTags.negative;

        // Helping Each Other (p. 131): +1 Power per contributed tag (never burned).
        const helpingContribs = (this.helpingTags ?? []).map(h => ({ name: `${h.name} (${h.helperName})`, positive: true, source: "help" }));
        numPositiveTags += helpingContribs.length;


        const dicePromises = [];

        let rollFormula = `2d6`;
        if (numPositiveTags > 0) rollFormula += ` + ${numPositiveTags}`;
        if (numNegativeTags > 0) rollFormula += ` - ${numNegativeTags}`;

        let numPowerTags = parseInt(numPositiveTags) - parseInt(numNegativeTags);

        if (mightScale != 0) {
            rollFormula += ` + ${mightScale}`;
            numPowerTags += mightScale;
        }

        // clamp only AFTER might is applied, otherwise a negative tag total
        // gets lifted to 1 first and might is added on top (issue #97)
        if (numPowerTags <= 0) numPowerTags = 1; // at least 1 power tag

        const diceRoll = new Roll(rollFormula, this.actor.getRollData());
        await diceRoll.evaluate();

        this.addShowDicePromise(dicePromises, diceRoll);
        await Promise.all(dicePromises);

        let diceResults = [...diceRoll.terms[0].results].map(r => r.result);

        let isCritical = (diceResults[0] === 6 && diceResults[1] === 6);
        let isFumble = (diceResults[0] === 1 && diceResults[1] === 1);

        let diceRollHTML = await diceRoll.render();

        let consequenceResult = -1;
        if (diceRoll.total >= 10) {
            consequenceResult = 1;
        }
        else if (diceRoll.total >= 7 && diceRoll.total <= 9) {
            consequenceResult = 0;
        }

        // double sixes always mean Success without Consequences, double ones
        // always Consequences without Success — regardless of Power!!!!
        if (isCritical) consequenceResult = 1;
        if (isFumble) consequenceResult = -1;

        let positiveTags = [...tagsAndStatusForRoll.filter(t => t.positive), ...helpingContribs];
        let negativeTags = tagsAndStatusForRoll.filter(t => !t.positive);

        const chatVars = {
            diceRollHTML: diceRollHTML,
            label: game.i18n.localize(`MIST_ENGINE.ROLL_TYPES.${this.rollType}`),
            tagsAndStatusForRoll: this.tagsAndStatusForRoll,
            positiveTags: positiveTags,
            negativeTags: negativeTags,
            consequenceResult: consequenceResult,
            isCritical: isCritical,
            isFumble: isFumble,
            numPowerTags: numPowerTags,
        };

        const speaker = ChatMessage.getSpeaker({ actor: this.actor });
        if (this.rollType === "detailed") {
            // detailed action gets an interactive Power-spending tracker (p. 154)
            await DetailedSpend.createDetailedMessage(chatVars, speaker);
        } else {
            const html = await foundry.applications.handlebars.renderTemplate(
                `systems/mist-engine-fvtt/templates/chat/${this.rollType}-result.hbs`,
                chatVars
            );
            ChatMessage.create({ content: html, speaker });
        }

        this.numModPositive = 0;
        this.numModNegative = 0;
        this.mightScale = 0;
        this.helpingTags = [];
        this.pendingHelpReqId = null;
        this.invertedTags.clear(); // #35: the inversion only applied to this roll
        this.invertedChallengeEntries.clear(); // #104: the inversion only applied to this roll

        this.resetTags();
        this.close();
    }

    addShowDicePromise(promises, roll) {
        if (game.dice3d) {
            // we pass synchronize=true so DSN dice appear on all players' screens
            promises.push(game.dice3d.showForRoll(roll, game.user, true, null, false));
        }
    }

    static async #handleClickModPositiveMinus(event, target) {
        const input = target.parentElement.querySelector("#positiveInput");
        input.stepDown();
        this.numModPositive = parseInt(input.value);
        if (this.numModPositive < 0) {
            this.numModPositive = 0;
            input.value = 0;
        }
        this.render()
    }
    static async #handleClickModPositivePlus(event, target) {
        const input = target.parentElement.querySelector("#positiveInput");
        input.stepUp();
        this.numModPositive = parseInt(input.value);
        this.render()
    }
    static async #handleClickModNegativeMinus(event, target) {
        const input = target.parentElement.querySelector("#negativeInput");
        input.stepDown();
        this.numModNegative = parseInt(input.value);
        if (this.numModNegative < 0) {
            this.numModNegative = 0;
            input.value = 0;
        }
        this.render()
    }

    static async #handleClickModNegativePlus(event, target) {
        const input = target.parentElement.querySelector("#negativeInput");
        input.stepUp();
        this.numModNegative = parseInt(input.value);
        this.render()
    }

    static async #handleTagStatusModifierToggle(event, target) {
        const index = parseInt(target.dataset.index);
        await FloatingTagAndStatusAdapter.handleTagStatusModifierToggle(this.actor, index - 1);
        this.updateTagsAndStatuses(true);
    }

    /**
     * #35: toggle a Weakness tag to count as Power — or a Power tag to count as
     * Weakness — for this roll only (Narrator discretion). Purely in-memory on
     * this dialog instance — nothing is written to the actor.
     * updateTagsAndStatuses() re-derives selectedTags from the persisted
     * documents, and prepareTags() re-applies this Set to the freshly derived
     * entries, so the toggle survives that re-derivation.
     */
    static async #handleToggleTagInversion(event, target) {
        const key = target.dataset.tagKey;
        if (!key) return;
        const tag = this.selectedTags.find(t => t.tagKey === key);
        // a tag marked to burn still gets burned after the roll — letting it
        // also count as a Weakness would spend the resource for a penalty
        if (tag?.toBurn && !this.invertedTags.has(key)) {
            ui.notifications.warn(game.i18n.localize("MIST_ENGINE.ROLL.CannotInvertBurningTag"));
            return;
        }
        if (this.invertedTags.has(key)) {
            this.invertedTags.delete(key);
        } else {
            this.invertedTags.add(key);
        }
        this.updateTagsAndStatuses(true);
    }

    /**
     * #104: toggle a Challenge/Scene-Story entry's polarity for this roll only
     * (Narrator discretion) — e.g. a challenge's positive swift-4 status is applied
     * as -4 against the roll — without editing the challenge or scene document.
     * Purely in-memory on this dialog instance. updateTagsAndStatuses() re-derives
     * challengeTags/selectedStoryTags from the persisted documents, and
     * prepareChallengeTags()/prepareSceneAndStoryTags() re-apply this Set to the
     * freshly derived entries, so the toggle survives that re-derivation.
     */
    static async #handleToggleChallengeInversion(event, target) {
        const key = target.dataset.challengeKey;
        if (!key) return;
        if (this.invertedChallengeEntries.has(key)) {
            this.invertedChallengeEntries.delete(key);
        } else {
            this.invertedChallengeEntries.add(key);
        }
        this.updateTagsAndStatuses(true);
    }

    static async #handleClickDeselectTag(event, target) {
        const index = parseInt(target.dataset.index);

        const tagToDeselect = this.selectedTags[index];
        if (!tagToDeselect) {
            console.warn("No tag found to deselect at index:", index);
            return;
        }
        else {
            // an explicit deselect withdraws the per-roll inversion too — otherwise a
            // later reselect would silently come back inverted
            if (tagToDeselect.tagKey) {
                this.invertedTags.delete(tagToDeselect.tagKey);
            }
            // we check if this is a power tag or weakness tag from a themebook and if a themebook id is provided
            if (tagToDeselect.source === null && tagToDeselect.themebookId) {
                if (tagToDeselect.weakness) {
                    await PowerTagAdapter.deselectPowerTag(this.actor, tagToDeselect.themebookId, `system.weaknesstags.${tagToDeselect.index}.selected`);
                }
                else {
                    await PowerTagAdapter.deselectPowerTag(this.actor, tagToDeselect.themebookId, `system.powertags.${tagToDeselect.index}.selected`);
                }
                this.updateTagsAndStatuses(true);
            }
            // now the backpack
            else if (tagToDeselect.source === "backpack") {
                //get the backpack from the actor in one line
                let backpackItem = this.actor.items.find(i => i.type === "backpack");
                // backpacks contains powertags 
                if (backpackItem) {
                    await StoryTagAdapter.toggleStoryTagSelection(this.actor, backpackItem.id, 'system.items', tagToDeselect.index - 1);
                    this.updateTagsAndStatuses(true);
                }
            }
            // now rotes
            else if (tagToDeselect.source === "rote") {
                const rote = this.actor.items.get(tagToDeselect.roteId);
                if (rote) {
                    await rote.update({ "system.selected": false });
                    this.updateTagsAndStatuses(true);
                    this.actor.sheet.render();
                }
            }
            // now floating tag or status
            else if (tagToDeselect.source === "floating-tag") {
                await FloatingTagAndStatusAdapter.handleTagStatusSelectedToggle(this.actor, tagToDeselect.index - 1);
                this.updateTagsAndStatuses(true);
            }
            // now for fellowship theme cards
            else if (tagToDeselect.source === "fellowship-themecard") {
                let fellowshipThemecard = this.actor.sheet.getActorFellowshipThemecard();
                if (fellowshipThemecard) {
                    // a raw dotted update like "system.powertags.N.selected" would
                    // replace the whole ArrayField and wipe all tags (#deselect bug)
                    if (tagToDeselect.weakness) {
                        await ArrayFieldAdapter.set(fellowshipThemecard, "system.weaknesstags", tagToDeselect.index, "selected", false);
                    }
                    else {
                        await ArrayFieldAdapter.set(fellowshipThemecard, "system.powertags", tagToDeselect.index, "selected", false);
                    }
                    this.updateTagsAndStatuses(true);
                    this.actor.render({ force: false })
                }
            }
            // now for fellowship-relationship
            else if (tagToDeselect.source === "fellowship-relationship") {
                let fellowships = this.actor.system.fellowships;
                let indexOfTag = tagToDeselect.index - 1;
                if (fellowships && fellowships.length > indexOfTag) {
                    fellowships[indexOfTag].selected = false;
                    await this.actor.update({ 'system.fellowships': fellowships });
                    this.updateTagsAndStatuses(true);
                    this.actor.render({ force: false })
                }
            }
        }
    }
}