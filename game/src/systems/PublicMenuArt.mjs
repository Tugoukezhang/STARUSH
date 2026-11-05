import {PUBLIC_EQUIPMENT} from '../utils/publicPreparation.mjs';
import {getEquipmentIconArt} from './EquipmentIconArt.mjs';
const base='art/formal-ui-20261016/';
export const PUBLIC_MENU_ART=Object.freeze({
 ...Object.fromEntries(['home','members','route','bag','records','hub','training','goals','journal','notes','nozzle','lens'].map(id=>[id,base+id+'.webp'])),
 ...Object.fromEntries(['relay','tempo','echo','overdrive','recovery'].map(id=>[id,base+id+'.webp'])),
 wide_brush:base+'nozzle.webp',
 rain_relay:getEquipmentIconArt('rain_relay').src,
 ...Object.fromEntries(Object.entries({members:'members',route:'tour',bag:'equipment',records:'records',training:'training',journal:'records',settings:'settings'}).map(([id,file])=>[id,'art/playable-ui-20261018/'+file+'.webp'])),
});
export const EQUIPMENT_MENU_ART=Object.freeze(Object.fromEntries(PUBLIC_EQUIPMENT.map(item=>[
 item.id,item.art||{wide_nozzle:'nozzle',rhythm_sync:'tempo',focus_lens:'lens',rain_relay:'rain_relay'}[item.id],
])));
export const PUBLIC_TITLE_ART=Object.freeze({src:'art/menu-lettering-20261021/titles.png',
 single:Object.freeze({inventory:'art/inner-poster-family-20261025/inventory-title.png',tour:'art/inner-poster-family-20261025/tour-title.png',workshop:'art/home-lettering-20261022/training.png'}),
 singleDimensions:Object.freeze({inventory:Object.freeze([590,292]),tour:Object.freeze([609,307]),workshop:Object.freeze([512,128])}),
 rows:Object.freeze({roster:0,preflight:2})});
const navIcons={desk:'home',roster:'members',tour:'route',inventory:'bag',records:'records',workshop:'training'};
const actionIcons={preflight:'home',prepare:'training','story-journal':'journal','play-hub':'hub',
 'home-preflight':'home','home-records':'records','hub-preflight':'home','hub-goals':'goals','hub-library':'journal',
 'hub-training':'training','hub-inventory':'bag','hub-growth':'training','hub-records':'records','hub-story-journal':'journal',
 'preflight-member':'members','preflight-training':'training','preflight-inventory':'bag','preflight-chapter':'route','preflight-goals':'goals','preflight-library':'journal','route-choice':'route',
 'training-catalog':'journal','inventory-catalog':'journal',settings:'settings',
 'replay-proposal':'route','replay-confirm':'goals','replay-cancel':'records','hub-finale-trial':'goals','trial-tour':'route'};

export function getPublicMenuIcon(name,parent){
 if(['arrow-left','arrow-right','play'].includes(name))return null;
 const data=parent?.dataset||{};
 if(data.action==='settings')return 'settings';
 const equipment=EQUIPMENT_MENU_ART[data.inventoryItem||data.equipment];
 if(equipment)return equipment;
 if(data.goal)return 'goals';
 if(parent?.className?.split(' ').includes('shell-wallet'))return 'notes';
 return navIcons[data.nav]||actionIcons[data.action]||null;
}
