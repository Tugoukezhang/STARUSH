import {loadPublicProfile,recordPublicRun,retryPublicProfileSave} from '../utils/publicRunProgression.mjs';
import {getPreparationResources,getOwnedEquipment} from '../utils/publicPreparation.mjs';
import {getPublicPerformanceRecord,getPerformanceComparison} from '../utils/publicPerformanceRecords.mjs';

const owners=new WeakMap();
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const capture=value=>freeze(JSON.parse(JSON.stringify(value)));

// A runtime receipt is not another persisted ledger or reward writer.
export function isPublicSettlementSaved(result){
  if(result?.persisted!==true)return false;
  if(!Object.hasOwn(result,'settlement'))return true; // Explicit legacy result compatibility.
  const r=result.settlement;
  return result.recorded===true&&r?.version===1&&r.modeId==='campaign'&&r.status==='saved'
    &&r.runId===result.runId&&r.performerId===result.performerId&&r.chapterId===result.chapterId;
}

export class PublicRunSettlement{
  constructor(summary,details={}){this.summary=capture(summary);this.details=capture(details);}
  commit(){
    if(this.result?.settlement.status==='saved')return this.result;
    let profile;
    if(!this.result){
      const before=loadPublicProfile(),data=this.summary;
      const previous=getPublicPerformanceRecord(before,data.chapterId,data.performerId,data.rulesetId);
      profile=recordPublicRun(data);
      this.result={...data,...this.details,performanceComparison:getPerformanceComparison(previous,
        {...data,durationMs:Math.floor(data.durationMs)}),reward:capture({
        notes:Math.max(0,getPreparationResources(profile).earned-getPreparationResources(before).earned),
        equipmentIds:getOwnedEquipment(profile).filter(item=>!getOwnedEquipment(before).some(old=>old.id===item.id)).map(item=>item.id),
      })};
      owners.set(this.result,this);
    }else{
      // Retry only the existing queued operation. Re-recording would resurrect an external reset.
      profile=retryPublicProfileSave();
    }
    const recorded=!profile.recovery&&profile.recordedRunIds.includes(this.summary.runId);
    const persisted=recorded&&profile.persisted===true&&profile.hasPendingSave!==true&&!profile.recovery;
    Object.assign(this.result,{recorded,persisted,clears:profile.clears,campaignCompleted:profile.campaign.completed,
      settlement:Object.freeze({version:1,modeId:'campaign',runId:this.summary.runId,
        performerId:this.summary.performerId,chapterId:this.summary.chapterId,
        status:persisted?'saved':recorded?'pending':'rejected'})});
    return this.result;
  }
}

export function retryPublicRunSettlement(result){return owners.get(result)?.commit()??null;}
