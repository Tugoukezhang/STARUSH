// Only the explicit resume factory may bind a new Scene to an existing saved run.
export function createFreshPublicBattleData(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const {publicBattleResume,...fresh}=data;
 return fresh;
}
