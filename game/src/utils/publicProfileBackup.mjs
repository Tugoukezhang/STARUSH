export const PROFILE_BACKUP_MAX_BYTES = 1024 * 1024;
const FORMAT = 'starush.profile-backup';
const bytes = text => new TextEncoder().encode(text);
async function digest(profile) {
  const value = await globalThis.crypto.subtle.digest('SHA-256', bytes(JSON.stringify(profile)));
  return [...new Uint8Array(value)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function encodeProfileBackup(profile, {buildId, rulesetId}) {
  const payload = {format:FORMAT, version:1, createdAt:new Date().toISOString(), buildId, rulesetId,
    profile, sha256:await digest(profile)};
  const text = JSON.stringify(payload, null, 2);
  if (bytes(text).length > PROFILE_BACKUP_MAX_BYTES) throw new Error('too-large');
  return text;
}
export async function decodeProfileBackup(text) {
  if (typeof text !== 'string') return {status:'invalid-backup'};
  if (text.length > PROFILE_BACKUP_MAX_BYTES || bytes(text).length > PROFILE_BACKUP_MAX_BYTES) return {status:'too-large'};
  try {
    const value = JSON.parse(text);
    if (!value || value.format !== FORMAT) return {status:'invalid-backup'};
    if (value.version !== 1) return {status:'unsupported-backup'};
    if (!value.profile || typeof value.profile !== 'object' || Array.isArray(value.profile)
      || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.buildId !== 'string'
      || typeof value.rulesetId !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)
      || await digest(value.profile) !== value.sha256) return {status:'invalid-backup'};
    return {status:'ready', profile:value.profile, createdAt:value.createdAt, buildId:value.buildId, rulesetId:value.rulesetId};
  } catch { return {status:'invalid-backup'}; }
}
