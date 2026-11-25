import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {createReleaseIdentity} from './release-identity.mjs';

const group = (name, base, files) => files.map(file => Object.freeze({ file: base + file, group: name }));
export const Q_REBASE_TRIAL_PAYLOAD = Object.freeze(group('five-q-trial', 'art/five-q-trial-20261013/',
  ['sakura.webp','sakura.json','venus.webp','venus.json','genya.webp','genya.json','kai.webp','kai.json','enjo.webp','enjo.json']));
export const ENJO_VISUAL_STUDY_PAYLOAD = Object.freeze(group('enjo-visual-study','art/enjo-visual-study-20261014/',
  ['atlas-gait.webp','atlas-gait.json','avatar.webp','portrait.webp','victory.webp','defeat.webp','lobby.webp']));
// Explicit filenames only: adding source art must never silently enlarge a release.
export const RUNTIME_PAYLOAD = Object.freeze([
  ...group('setdesign-art','art/setdesign/',[
    'foyer.webp','wardrobe.webp','route.webp','workbench.webp','archive.webp','rehearsal.webp','office.webp','observatory.webp',
    'card.webp','note.webp','monitor.webp','dialog.webp','strip.webp','stub.webp',
    'avatar-sakura.webp','avatar-kai.webp','avatar-enjo.webp','home-logo.webp',
  ]),
  ...group('printroom-surfaces','art/printroom/',['primary.webp','paper.webp','ink.webp','motif.webp','dressing.webp','gear.webp','records.webp','rehearsal.webp','chime-icon.png','book-icon.png',
    'item-sound.webp','item-pulse.webp','item-focus.webp','item-rain.webp','item-delay.webp','item-echo.webp','item-leaf.webp']),
  ...group('tour-landmarks','art/showbill/',['stop-opening.webp','stop-neon.webp','stop-encore.webp','stop-raincheck.webp','stop-homecoming.webp']),
  ...group('owner-weapon-fx','art/infield/',['ground-footprints.webp','wet-splash.webp']),
  ...group('concert-navigation','art/infield/',['nav-desk.webp','nav-roster.webp','nav-tour.webp','nav-inventory.webp']),
  ...group('showbill-environments','art/showbill/',['stage.webp','console.webp','city.webp','archive.webp','openair.webp','harbor-map.webp']),
  ...group('owner-blue-academy','art/blue-academy-20261123/',['motion.png','portrait.png','avatar.png','weapon.png','spell.png']),
  ...group('owner-story-reader-298','art/story-reader-298/',['control.webp']),
  ...group('owner-training-296','art/training-296/',['notes.webp']),
  ...group('owner-rooftop-supply-297','art/rooftop-supply-297/',['power.webp']),
  ...group('owner-rain-relay-295','art/rain-relay-295/',['rain_relay.webp']),
  ...group('owner-battle-signals-293','art/battle-signals-b293/',['guidance.webp','phase.webp','action.webp','danger.webp']),
  ...group('owner-chapter-sheet-294','art/chapter-sheet-294/',['tab.webp','close.webp']),
  ...group('owner-choice-studio-290','art/choice-studio-20261104/',['ticket.webp','heading.webp','fanfire.webp']),
  ...group('role-echo-302','art/role-echo-b302/',['kai.webp','enjo.webp']),
  ...group('choice-stage-303','art/choice-stage-b303/',['row.webp','confirm.webp']),
  ...group('kai-sword-sequence-292','art/kai-sword-sequence-292/',['slash.webp']),
  ...group('owner-archive-journal-289','art/archive-journal-20261104/',['paper.webp','story-tab.webp','chevron.webp','raincheck.webp']),
  ...group('owner-kai-refinement-287','portraits/kai-287/',['renderer.js','mesh-avatar.js','LICENSE.mesh-avatar.txt','rig.json','avatar.json','source.png','kai-avatar.webp',
    'built/base.png','built/hairmask.png','built/layers.json','built/eye0_ball.png','built/eye0_lash.png','built/eye0_low.png','built/eye0_crease.png',
    'built/eye1_ball.png','built/eye1_lash.png','built/eye1_low.png','built/eye1_crease.png','built/sprites/sprites.json','built/overlays/overlays.json']),
  ...group('owner-enjo-refinement-286','portraits/enjo-286/',['renderer.js','mesh-avatar.js','LICENSE.mesh-avatar.txt','rig.json','avatar.json','source.png','enjo-avatar.webp',
    'built/base.png','built/hairmask.png','built/layers.json','built/eye0_ball.png','built/eye0_lash.png','built/eye0_low.png','built/eye0_crease.png',
    'built/eye1_ball.png','built/eye1_lash.png','built/eye1_low.png','built/eye1_crease.png','built/sprites/sprites.json','built/overlays/overlays.json']),
  ...group('owner-enjo-mesh-285','portraits/enjo-285/',['renderer.js','mesh-avatar.js','LICENSE.mesh-avatar.txt','rig.json','avatar.json',
    'built/base.png','built/hairmask.png','built/layers.json','built/eye0_ball.png','built/eye0_lash.png','built/eye0_low.png','built/eye0_crease.png',
    'built/eye1_ball.png','built/eye1_lash.png','built/eye1_low.png','built/eye1_crease.png','built/sprites/sprites.json','built/overlays/overlays.json']),
  ...group('owner-preflight-console','art/preflight-console-20261103/',['choice.webp','clear.webp']),
  ...group('owner-roof-broadcast','art/roof-broadcast-20261103/',['stage.webp']),
  ...group('owner-member-training-console','art/member-training-20261103/',['console.webp','command.webp']),
  ...group('owner-rooftop','art/rooftop-20261103/',['color.webp','neutral.webp','venue.webp','title.webp','landmark.webp']),
  ...group('owner-homecoming-300','art/homecoming-300/',['title.webp']),
  ...group('owner-preflight-studio','art/preflight-studio-20261102/',['letter-loadout.webp','letter-route.webp','letter-arrangement.webp','letter-goal.webp','letter-details.webp','letter-equipment.webp','letter-train.webp','letter-start.webp','letter-keep.webp','letter-restart.webp','letter-choose.webp','letter-preflight.webp']),
  ...group('owner-planning-studio','art/planning-studio-20261102/',['letter-growth.webp','letter-library.webp','letter-compare.webp','letter-equipment.webp','letter-current.webp','letter-planned.webp','letter-effects.webp','letter-guide.webp','letter-sources.webp','letter-confirm.webp','letter-preflight.webp','letter-studies.webp','letter-gear.webp','letter-pick.webp','letter-idle.webp']),
  ...group('owner-archive-studio','art/archive-studio-20261102/',['letter-light-records.webp','letter-light-chapterArchive.webp','letter-light-chapter-opening.webp','letter-light-chapter-neon.webp','letter-light-chapter-encore.webp','letter-light-history.webp','letter-light-journal.webp','letter-light-prepare.webp','letter-light-field.webp','letter-light-events.webp']),
  ...group('owner-archive-studio','art/archive-studio-20261102/',['room.webp','letter-records.webp','letter-chapterArchive.webp','letter-chapter-opening.webp','letter-chapter-neon.webp','letter-chapter-encore.webp','letter-history.webp','letter-journal.webp','letter-prepare.webp','letter-field.webp','letter-events.webp','ticket.webp','panel.webp']),
  ...group('owner-venue-studio','art/venue-studio-20261101/',['stage.webp','rehearsal.webp','lounge.webp','letter-stage.webp','letter-rehearsal.webp','letter-lounge.webp','letter-assign.webp','letter-prepare.webp','letter-schedule.webp','letter-member.webp','letter-program.webp','letter-stage-soundcheck.webp','letter-stage-blocking.webp','letter-rehearsal-rhythm.webp','letter-rehearsal-ensemble.webp','letter-lounge-rest.webp','letter-lounge-review.webp']),
  ...group('owner-console-studio','art/console-studio-20261102/',['desk.webp','letter-backstage.webp','letter-services.webp','letter-events.webp','letter-practice.webp','letter-members.webp','letter-sound.webp','letter-backup.webp','letter-local.webp','letter-network.webp','letter-export.webp','letter-import.webp','letter-return-settings.webp','icon-program.webp','icon-practice.webp','icon-settings.webp','icon-backup.webp','skin-primary.webp','skin-row.webp','skin-panel.webp','skin-tile.webp']),
  ...group('owner-program-studio','art/program-studio-20261101/',['program-stage.webp','practice-score.webp','practice-target.webp','letter-chapters.webp','letter-goal-info.webp','letter-practice.webp','letter-program.webp','letter-set-goal.webp']),
  ...group('owner-companion-studio','art/companion-studio-20261101/',['greeting.webp','rehearsal.webp','encore.webp','record.webp','icon-greeting.webp','icon-rehearsal.webp','icon-encore.webp','dialogue.webp']),
  ...group('owner-inventory-studio','art/inventory-studio-20261101/',['all.webp','owned.webp','compatible.webp','equip.webp','unequip.webp','source.webp','icon-all.webp','icon-owned.webp','icon-compatible.webp']),
  ...group('owner-member-studio','art/member-studio-20261101/',['letter-current.webp','letter-next.webp','letter-notes.webp','letter-train.webp','letter-growth.webp','letter-switch.webp','role-rifle.webp','role-hammer.webp','role-sword.webp']),
  ...group('owner-chapter-journey','art/chapter-journey-20261101/',['opening.webp','neon.webp','encore.webp','map.webp','mode-finale.webp','mode-rehearsal.webp','letter-intro.webp','letter-midpoint.webp','letter-outro.webp','letter-goals.webp','letter-rewards.webp','letter-program.webp','letter-plan.webp','letter-rehearsal.webp','letter-finale.webp','goal-standard.webp','goal-steady.webp','goal-pace.webp']),
  ...group('owner-thin-ui','art/thin-ui-20261101/',['row.webp','selected.webp','tab.webp','primary.webp','panel.webp']),
  ...group('owner-chapter-practice-room','art/chapter-journey-20261101/',['practice-room.webp']),
  ...group('owner-lobby-widgets','art/lobby-widgets-20261101/',['backstage.webp','program.webp','rehearsal.webp','performers.webp','save.webp']),
  ...group('owner-screen-rebuild','art/screen-rebuild-20261101/',['storage.webp','story.webp']),
  ...group('owner-enjo-rig-candidate','art/enjo-portrait-rig-20261101/',['enjo.webp','enjo-avatar.webp']),
  ...group('owner-enjo-rig-candidate','rigs/companion-enjo-20261101/',['enjo.p2lrt']),
  ...group('owner-secondary-ui','art/secondary-ui-20261101/',[
    'letter-growth.webp','letter-library.webp','letter-records.webp','letter-venue.webp','letter-train.webp','letter-apply.webp','letter-confirm.webp','letter-cancel.webp','letter-assign.webp','letter-collapse.webp','letter-first.webp','letter-second.webp','letter-sources.webp','letter-compare.webp','letter-room.webp','letter-preflight.webp']),
  ...group('owner-menu-hierarchy','art/hierarchy-ui-20261101/',[
    'widget-settings.webp','widget-lock.webp','widget-owned.webp','widget-selected.webp','widget-companion.webp','widget-venue.webp','widget-modes.webp','widget-switch.webp','widget-member.webp','widget-equipment.webp','widget-train.webp','widget-route.webp','widget-skill.webp','widget-info.webp','widget-archive.webp','letters-tour-confirm.webp',
    'backstage.webp','icons-home.webp','icons-member.webp','icons-tour.webp','icons-bag.webp','icons-companion.webp','icons-venue.webp','icons-modes.webp','icons-switch.webp','icons-back.webp','icons-close.webp','icons-train.webp','icons-equipment.webp','icons-skill.webp','icons-info.webp','icons-route.webp','icons-archive.webp',
    'letters-roster.webp','letters-tour.webp','letters-inventory.webp','letters-preflight.webp','letters-workshop.webp','letters-start.webp','letters-resume.webp','letters-confirm.webp','letters-sakura.webp','letters-kai.webp','letters-enjo.webp','letters-open.webp','letters-chapter-opening.webp','letters-chapter-neon.webp','letters-chapter-encore.webp','letters-switch.webp',
    'skin-slot.webp','skin-selected.webp','skin-primary.webp','skin-secondary.webp','skin-panel.webp','skin-dialogue.webp']),
  ...group('owner-portrait-base-candidate','art/cast-portrait-20261101/',['enjo.webp','kai.webp','enjo-avatar.webp','kai-avatar.webp']),
  ...group('owner-companion-rig','rigs/companion-sakura-20261031/',['sakura.p2lrt']),
  ...group('mit-companion-runtime','vendor/psd2live-3.6.6/',['p2l.js','p2l_runtime.wasm','LICENSE.txt']),
  ...group('owner-companion-room','art/companion-room-20261031/',['lounge.webp']),
  ...group('owner-companion-dialogue','art/companion-dialogue-20261031/',['dialogue.webp']),
  ...group('owner-chapter-result','art/result-stage-20261031/',['complete.webp']),
  ...group('owner-battle-control-art','art/battle-controls-20261031/',['rifle.webp','sword.webp','hammer.webp','encore.webp']),
  ...group('owner-ai-control-family','art/owner-ui-family-20261031/',['companion.webp','venue.webp','progress.webp','history.webp','training.webp','play.webp','primary.webp','secondary.webp','selected.webp','tab.webp','dialogue.webp','ledger.webp']),
  ...group('owner-roster-stage','art/roster-studio-20261031/',['stage.webp']),
  ...group('owner-menu-expression','art/menu-expression-20261031/',['enjo-blink.webp','enjo-smile.webp','kai-blink.webp','kai-smile.webp']),
  ...group('third-party-license','licenses/',['lucide-gameplay.txt']),
  ...group('owner-menu-portrait','art/menu-series-cast-20261031/',['kai.webp','enjo.webp','kai-avatar.webp','enjo-avatar.webp']),
  ...group('owner-weapon-fx','art/rounded-ink-footprint-20261029/',['pool.png']),
  ...group('owner-weapon-fx','art/heavy-pigment-contact-20261029/',['landing.webp']),
  ...group('owner-heavy-joint-rig','art/enjo-north-rig-20261029/',['parts.webp']),
  ...group('owner-heavy-joint-rig','art/enjo-continuous-rig-20261028/',['parts.webp']),
  ...group('owner-ui','art/venue-shell-20261026/',['venue.webp','start.png']),
  ...group('owner-ui','art/roster-lettering-20261028/',['sakura.png','kai.png','enjo.png']),
  ...group('owner-combat','art/melee-authored-20261026/',['kai-attack.webp','enjo-attack.webp','melee-process.webp']),
  ...group('owner-combat','art/melee-directional-20261026/',['kai-vertical-grid.webp','enjo-vertical-grid.webp']),
  ...group('owner-combat','art/melee-heavy-bridge-20261028/',['enjo-20-grid.webp']),
  ...group('owner-ui','art/inner-poster-family-20261025/',['tour-title.png','inventory-title.png','equipment-bay.png','tour-ticket.png']),
  ...group('owner-ui','art/home-integrity-20261025/',['start.png','name-sakura.png']),
  ...group('owner-equipment-art','art/equipment-identity-20261025/', ['wide_nozzle.png','rhythm_sync.png','focus_lens.png','travelling_nozzle.png','return_edge.png','delayed_hammer.png']),
  ...group('offline-ui-font', 'fonts/', ['NotoSansSC-UI.woff2']),
  ...group('third-party-license', 'licenses/', ['noto-sans-sc.txt']),
  ...group('owner-weapon-fx', 'art/compact-pool-ground-20261023/', ['pool.png']),
  ...group('owner-weapon-fx', 'art/comic-dense-pool-20261024/', ['pool.png']),
  ...group('owner-weapon-fx', 'art/three-cast-comic-material-20261023/', ['planes.png']),
  ...group('owner-weapon-fx', 'art/world-comic-pigment-20261023/', ['planes.png']),
  ...group('owner-weapon-fx', 'art/ink-pocket-pigment-20261023/', ['planes.png']),
  ...group('owner-weapon-fx', 'art/printed-floor-pigment-20261024/', ['planes.png']),
  ...group('owner-weapon-fx', 'art/comic-ink-planes-20261029/', ['body.png']),
  ...group('owner-weapon-fx', 'art/comic-paint-directional-20261023/', ['planes.png']),
  ...group('owner-weapon-fx-compat', 'art/comic-paint-material-20261023/', ['planes.png']),
  ...group('third-party-license', 'licenses/', ['pathfinding.txt']),
  ...group('owner-ui', 'art/core-journey-20261018/', ['primary.webp','secondary.webp','panel.webp']),
  ...group('owner-ui', 'art/home-identity-family-20261024/', ['plates.png']),
  ...group('owner-ui', 'art/menu-lettering-20261021/', ['titles.png']),
  ...group('owner-ui', 'art/inner-screen-lettering-20261024/', ['inventory.png']),
  ...group('owner-ui', 'art/battle-reading-20261024/', ['pause-title.png']),
  ...group('owner-menu-portrait', 'art/menu-portraits-20261024/', ['kai.webp','enjo.webp']),
  ...group('owner-menu-portrait', 'art/menu-identity-cast-20261026/', ['kai.webp']),
  ...group('owner-menu-portrait', 'art/menu-enjo-illustration-20261028/', ['enjo.webp']),
  ...group('owner-ui', 'art/menu-coherent-cast-20261025/', ['sakura-avatar.webp']),
  ...group('owner-ui', 'art/menu-identity-cast-20261026/', ['kai-avatar.webp']),
  ...group('owner-ui', 'art/menu-enjo-illustration-20261028/', ['enjo-avatar.webp']),
  ...group('owner-ui', 'art/playable-ui-20261018/', ['primary.webp','secondary.webp','title.webp','panel.webp','slip.webp','plaza.webp','members.webp','tour.webp','equipment.webp','records.webp','training.webp','settings.webp']),
  ...group('owner-ui', 'art/formal-ui-20261016/', ['home.webp','members.webp','route.webp','bag.webp','records.webp','hub.webp','training.webp','goals.webp','journal.webp','notes.webp','nozzle.webp','lens.webp','tempo.webp','relay.webp','echo.webp','overdrive.webp',
    'action-sakura.webp','action-kai.webp','action-enjo.webp','recovery.webp','primary.webp','secondary.webp','title.webp','status.webp','panel.webp','selected.webp','disc.webp','disc-ready.webp','lobby.webp']),
  ...group('owner-enemy-attack', 'art/harbor-ground-strike-20261016/', ['warning.webp']),
  ...group('owner-world-ground','art/map-presentation-20261018/', ['opening-neutral.webp','opening-color.webp','neon-neutral.webp','neon-color.webp','encore-neutral.webp','encore-color.webp']),
  ...group('owner-weapon-fx', 'art/graffiti-combat-20261018/', ['spray.webp','sweep.webp','burst.webp']),
  ...group('owner-weapon-fx', 'art/hammer-comic-contact-20261022/', ['burst.png']),
  ...group('owner-weapon-fx', 'art/heavy-pigment-swing-20261029/', ['chain.png']),
  ...group('owner-facility-fx', 'art/facility-ink-seal-20261029/', ['pop.png']),
  ...group('owner-weapon-fx', 'art/comic-ground-ribbons-20261022/', ['ground-v2.png']),
  ...group('owner-ui', 'art/comic-ui-20261021/', ['logo.png','encore.png','rifle.png','panel.png','lobby.webp']),
  ...group('owner-ui', 'art/skill-command-20261022/', ['encore.png','rifle.png','sword.png','hammer.png']),
  ...group('owner-ui', 'art/home-lettering-20261022/', ['start.png','rifle.png','sword.png','hammer.png','preflight.png','training.png','journal.png','hub.png']),
  ...group('owner-ui', 'art/home-comic-backstage-20261022/', ['backstage.webp']),
  ...group('owner-ui', 'art/home-portrait-demo-20261022/', ['sakura-body.webp','sakura-hair.webp','sakura-tail.webp','sakura-blink.webp','backstage.webp']),
  ...group('owner-ui', 'art/home-selected-reference-20261023/', ['chapters.png']),
  ...group('owner-ui', 'art/home-transparent-components-20261024/', ['components.png']),
  ...group('owner-ui', 'art/home-surface-clean-20261025/', ['components.png']),
  ...group('owner-menu-motion', 'art/menu-identity-cast-20261026/', ['eyes.png']),
  ...group('owner-menu-motion', 'art/menu-enjo-expression-20261028/', ['eyes.png']),
  ...group('owner-ui', 'art/chapter-venues-20261024/', ['opening.webp','neon.webp','encore.webp']),
  ...group('owner-ui', 'art/battle-header-20261022/', ['frame.png','icons.png']),
  ...group('owner-ui', 'art/briefing-reading-frame-20261022/', ['frame.png']),
  ...group('owner-ui', 'art/ready-lettering-20261022/', ['ready.png']),
  ...group('owner-ui', 'art/command-state-family-20261022/', ['ready.png','active.png','preparing.png','paused.png','ended.png']),
  ...group('owner-character-idle', 'art/rifle-idle-20261021/', ['idle.png']),
  ...group('owner-character-idle', 'art/rifle-rest-20261022/', ['idle.png']),
  ...group('owner-character-idle', 'art/enjo-rest-20261023/', ['idle.png']),
  ...group('owner-weapon-fx', 'art/rifle-ink-chain-20261022/', ['muzzle.png','projectile.png','contact.png']),
  ...group('owner-weapon-fx', 'art/kai-comic-projectile-20261024/', ['projectile.png']),
  ...group('owner-weapon-fx', 'art/kai-comic-contact-20261024/', ['contact.png']),
  ...group('owner-weapon-fx', 'art/duo-comic-contact-20261025/', ['contact.png']),
  ...group('owner-weapon-fx', 'art/rifle-compact-muzzle-20261022/', ['muzzle.png']),
  ...group('owner-weapon-fx', 'art/rifle-pigment-deposition-20261023/', ['deposition.png']),
  ...group('owner-ui', 'art/battle-comic-skin-20261021/', ['status-idle.png','status-ready.png','status-active.png']),
  ...group('owner-heavy-material', 'art/heavy-palette-impact-20261029/', ['impact.png']),
  ...group('owner-relay-feedback', 'art/relay-ink-transfer-20261029/', ['transfer.webp']),
  ...group('owner-dash-material', 'art/kai-dash-20261021/', ['dash.png']),
  ...group('owner-dash-contrast-material', 'art/kai-dash-contrast-20261021/', ['dash.png']),
  ...group('owner-character-motion', 'art/three-cast-actions-20261018/', ['cat-rifle.webp','mecha-sword.webp','hammer-cat.webp']),
  ...group('owner-red-valkyrie', 'art/red-valkyrie-20261123/', ['motion.png','portrait.png','avatar.png','weapon.png']),
  ...group('owner-green-windsong', 'art/green-windsong-20261123/', ['motion.png','portrait.png','avatar.png','weapon.png','wind.png']),
  ...group('owner-character-gait', 'art/enjo-gait-20261021/', ['walk.png']),
  ...group('owner-character-walk', 'art/rifle-walk-volume-20261022/', ['walk.png']),
  ...group('owner-character-hurt', 'art/enjo-hurt-20261021/', ['hurt.png']),
  ...group('owner-character-hurt', 'art/kai-hurt-20261021/', ['hurt.png']),
  ...group('owner-character-shoot', 'art/rifle-shoot-20261021/', ['shoot.png']),
  ...group('owner-character-cast', 'art/user-cast-20261015/', ['cat-rifle.webp','cat-rifle-avatar.webp','cat-rifle-battle.webp','mecha-sword.webp','mecha-sword-avatar.webp','mecha-sword-battle.webp','hammer-cat.webp','hammer-cat-avatar.webp','hammer-cat-battle.webp']),
  ...group('owner-ui', 'art/user-cast-ui-20261015/', ['primary.webp','secondary.webp','panel.webp','action.webp']),
  ...group('owner-ui', 'art/owner-battle-ui-20261015/', ['panel.webp','hud.webp','choice.webp','primary.webp','secondary.webp','ribbon.webp',
    'wide_brush.webp','relay.webp','tempo.webp','echo.webp','overdrive.webp','recovery.webp','action-sakura.webp','action-kai.webp','action-enjo.webp']),
  ...group('owner-ui', 'art/owner-public-menu-ui-20261015/', ['header.webp','dock.webp','slot.webp','slot-selected.webp','row.webp','row-selected.webp',
    'home.webp','members.webp','route.webp','bag.webp','records.webp','hub.webp','training.webp','goals.webp','journal.webp','notes.webp','nozzle.webp','lens.webp','lobby.webp']),
  ...group('mobile-lobby', 'art/mobile-lobby-20261014/', ['home-background.webp']),
  ...group('ui-surface-art', 'art/ui-system-20261015/', ['primary-action-sakura-stage.webp','secondary-panel-clean-sakura.webp']),
  ...group('five-q-ui', 'art/five-q-ui-20261013/', [
    'sakura-avatar.webp','sakura-portrait.webp','sakura-victory.webp','sakura-defeat.webp',
    'venus-avatar.webp','venus-portrait.webp','venus-victory.webp','venus-defeat.webp',
    'genya-avatar.webp','genya-portrait.webp','genya-victory.webp','genya-defeat.webp',
    'kai-avatar.webp','kai-portrait.webp','kai-victory.webp','kai-defeat.webp',
    'enjo-avatar.webp','enjo-portrait.webp','enjo-victory.webp','enjo-defeat.webp',
  ]),
  ...group('harbor-scene', 'art/harbor-cohesion-20261009/', [
    'ground.webp','shed.webp','shed-muted.webp','control.webp','control-muted.webp',
    'mixer.webp','mixer-muted.webp','stage.webp','stage-muted.webp','barrier.webp','signal.webp',
  ]),
  ...group('neonstreet-scene', 'art/neon-cohesion-20261009/', [
    'ground.webp','shop.webp','shop-muted.webp','cafe.webp','cafe-muted.webp',
    'pavilion.webp','pavilion-muted.webp','panel.webp','signal.webp','tree.webp','tree-muted.webp',
  ]),
  ...group('oldstreet-scene', 'art/street-volume-20260913/', [
    'gate.webp','panel.webp','lamp.webp','speaker.webp','power.webp',
  ]),
  ...group('oldstreet-scene', 'art/street-perspective-20261009/', [
    'ground.webp','tree.webp','tree-muted.webp',
    'shop.webp','shop-muted.webp','repair.webp','repair-muted.webp','garden.webp','garden-muted.webp',
    'kiosk.webp','kiosk-muted.webp','canopy.webp','canopy-muted.webp',
    'bookshop.webp','bookshop-muted.webp','cafe.webp','cafe-muted.webp',
    'tailor.webp','tailor-muted.webp','rehearsal.webp','rehearsal-muted.webp',
  ]),
  ...group('public-actors', 'art/enemy-ensemble-20261009/', [
    'runner.webp', 'emitter.webp', 'jammer.webp', 'relay.webp', 'captain.webp', 'conductor.webp',
  ]),
  ...group('public-actors', 'art/performer-motion-20260922/', [
    'venus-walk.webp', 'genya-walk.webp', 'kai-walk.webp', 'enjo-walk.webp',
  ]),
  ...group('public-actors', 'art/performer-portraits-20260925/', [
    'venus-avatar.webp','venus-portrait.webp',
    'genya-avatar.webp','genya-portrait.webp','kai-avatar.webp','kai-portrait.webp','enjo-avatar.webp','enjo-portrait.webp',
  ]),
  // Transparent battle cut-in remains separate from opaque roster illustrations.
  ...group('public-actors', 'art/sakura-redesign-20260913/', ['portrait.webp']),
  ...group('public-actors', 'art/performer-footrig-20260924/', ['kai-legs.webp','venus-legs.webp','genya-legs.webp','enjo-legs.webp']),
  ...group('public-actors', 'art/performer-reactions-20260924/', ['kai-reactions.webp','venus-reactions.webp','genya-reactions.webp','enjo-reactions.webp']),
  ...group('public-actors', 'art/performer-basic-20260925/', ['kai-basic.webp','venus-basic.webp','genya-basic.webp','enjo-basic.webp']),
  ...group('public-actors', 'art/performer-turn-20260925/', ['kai-turn.webp','venus-turn.webp','genya-turn.webp','enjo-turn.webp']),
  ...group('public-actors', 'art/sakura-native-20261004/', ['avatar.webp','portrait.webp']),
  ...group('public-actors', 'art/sakura-conformance-20261004/', ['rig.json']),
  ...group('public-actors', 'art/sakura-details-20261004/', ['views.json']),
  ...group('public-actors', 'art/sakura-turn-native-20261004/', ['views.json']),
  ...group('public-actors', 'art/sakura-hand-art-20261005/', ['front.webp','directions.webp','turns.webp']),
  ...group('public-actors', 'art/sakura-refined-20261006/', ['parts.webp','views.json']),
  ...group('public-actors', 'art/sakura-oblique-20261006/', ['parts.webp','views.json']),
  ...group('public-actors', 'art/venus-unified-20261012/', ['venus-parts.webp','venus-parts.json','venus-oblique.webp','venus-oblique.json']),
  ...group('public-actors', 'art/genya-unified-20261012/', ['genya-parts.webp','genya-parts.json','genya-oblique.webp','genya-oblique.json']),
  ...group('public-actors', 'art/kai-unified-20261012/', ['kai-parts.webp','kai-parts.json','kai-oblique.webp','kai-oblique.json']),
  ...group('public-actors', 'art/enjo-unified-20261012/', ['enjo-parts.webp','enjo-parts.json','enjo-oblique.webp','enjo-oblique.json']),
  ...group('public-scenes', 'art/phase16/p16-068-scenes/', [
    'opening-ground.webp', 'neon-ground.webp', 'encore-ground.webp',
    'speaker.png', 'projector.png', 'display.png', 'case.png',
  ]),
  ...group('shared-audio', 'audio/phase1/p1-7/', [
    'center_moment_stinger_candidate_b.wav', 'clear_fail_stinger_clear_candidate_b.wav',
    'clear_fail_stinger_fail_candidate_a.wav', 'encore_rush_stinger_candidate_b.wav',
    'hit_confirm_candidate_a.wav', 'player_damage_warning_candidate_b.wav', 'support_shot_tick_candidate_a.wav',
  ]),
  ...group('legacy-hidden-compatibility', '', [
    'particles-impact-atlas.png', 'particles-impact-atlas.json',
    'art/phase1/v5-1/bullet-note-vfx-v5-1-gameplay-512x256.png',
    'art/phase1/v5-1/bullet-note-vfx-v5-1-gameplay-512x256.json',
    'art/phase1/p1-6/stage1-music-festival-layered-preview-750x1334.png',
    'art/phase1/v5-1/stage-combat-idol-v5-1-a-gameplay-polish-750x1334.png',
    'art/phase1/p1-38/result_soft_sparkle.png', 'art/phase1/p1-38/replay_goal_pin.png',
    'art/phase1/p1-38/retry_path_chevron.png', 'art/phase1/p1-38/first_play_hint_tab.png',
    'art/hud/skill-disc.jpg', 'art/hud/burst-orb.jpg', 'art/hud/special-disc.jpg',
  ]),
]);

const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const absolute = value => path.resolve(value instanceof URL ? fileURLToPath(value) : value);
const within = (root, target) => { const relative = path.relative(root, target); return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative); };
function safeFile(root, file) {
  if (typeof file !== 'string' || !file || file.includes('\\') || file.includes(':') || file.split('/').some(p => !p || p === '.' || p === '..')) throw Error(`Unsafe payload path: ${file}`);
  const target = path.resolve(root, file);
  if (!within(root, target)) throw Error(`Unsafe payload path: ${file}`);
  return target;
}
function filesBelow(root) {
  const files = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error(`Payload symlink is not allowed: ${target}`);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile()) files.push(path.relative(root, target).replaceAll('\\', '/'));
    }
  };
  walk(root); return files.sort();
}
export function validateRuntimePayload(publicRoot, entries = RUNTIME_PAYLOAD) {
  const root = fs.realpathSync(absolute(publicRoot)), seen = new Set();
  return entries.map(entry => {
    const target = safeFile(root, entry.file);
    if (seen.has(entry.file)) throw Error(`Duplicate payload path: ${entry.file}`);
    seen.add(entry.file);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw Error(`Missing runtime asset: ${entry.file}`);
    if (!within(root, fs.realpathSync(target))) throw Error(`Escaped payload path: ${entry.file}`);
    const bytes = fs.readFileSync(target);
    return { ...entry, bytes: bytes.length, sha256: sha(bytes) };
  });
}

export function runtimePayloadPlugin(entries = RUNTIME_PAYLOAD) {
  let publicRoot, outputRoot, generated, release;
  return {
    name: 'runtime-payload-boundary', apply: 'build',
    config(config) {
      const root=fs.realpathSync(config.root||process.cwd());
      release=createReleaseIdentity(root,validateRuntimePayload(path.resolve(root,config.publicDir||'public'),entries));
      return {define:{__STARUSH_BUILD_ID__:JSON.stringify(release.buildId)}};
    },
    configResolved(config) {
      const root = fs.realpathSync(config.root);
      publicRoot = absolute(config.publicDir || path.join(root, 'public'));
      outputRoot = path.resolve(root, config.build.outDir);
      if (!within(root, outputRoot) || ['public', 'src', 'tests', 'scripts', 'node_modules'].some(dir => outputRoot === path.join(root, dir) || within(path.join(root, dir), outputRoot))) throw Error('Unsafe release output directory');
      let ancestor = outputRoot;
      while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
      if (fs.realpathSync(ancestor) !== ancestor) throw Error('Unsafe release output link');
      validateRuntimePayload(publicRoot, entries);
    },
    writeBundle(_options, bundle) { generated = new Set(Object.keys(bundle)); },
    closeBundle() {
      if (!generated) return; // Do not touch a previous build when compilation failed.
      const inventory = validateRuntimePayload(publicRoot, entries);
      const allowed = new Map(inventory.map(row => [row.file, row]));
      if (!fs.existsSync(outputRoot) || fs.realpathSync(outputRoot) !== outputRoot) throw Error('Unsafe release output real path');
      const actual = filesBelow(outputRoot), publicFiles = new Set(filesBelow(publicRoot));
      const excluded = actual.filter(file => publicFiles.has(file) && !allowed.has(file) && !generated.has(file));
      // Verify the full output before removing individual copied files, never sources.
      for (const file of actual) if (!allowed.has(file) && !generated.has(file) && !excluded.includes(file)) throw Error(`Unexpected release file: ${file}`);
      for (const row of inventory) {
        const target = safeFile(outputRoot, row.file);
        if (!fs.existsSync(target) || sha(fs.readFileSync(target)) !== row.sha256) throw Error(`Runtime asset output mismatch: ${row.file}`);
      }
      for (const file of excluded) fs.rmSync(safeFile(outputRoot, file));
      const files = filesBelow(outputRoot).map(file => {
        const data = fs.readFileSync(safeFile(outputRoot, file));
        return { file, group: allowed.get(file)?.group || 'generated-code', bytes: data.length, sha256: sha(data) };
      });
      const report = { schemaVersion: 1, ...(release?{release:{...release}}:{}), publicBytes: inventory.reduce((n, row) => n + row.bytes, 0), totalBytes: files.reduce((n, row) => n + row.bytes, 0), files, excludedSourceFiles: [...publicFiles].filter(file => !allowed.has(file)).sort() };
      fs.writeFileSync(path.join(outputRoot, 'runtime-payload.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(`[runtime-payload] ${inventory.length} assets, ${report.publicBytes} bytes; ${report.excludedSourceFiles.length} source files excluded, sources unchanged.`);
    },
  };
}
