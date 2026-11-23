import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const ECHO=Object.freeze({
  sakura:{label:'回响追加',delta:'第3次有效命中后 200ms 补色',detail:'原落点、不追踪；空击不计数，不递归。',tactic:/回响/},
  kai:{label:'回响回斩',delta:'每3次有效挥剑 → 延迟回斩',detail:'200ms后回斩125范围、140度；每目标14点，不追踪、不穿墙。',tactic:/延迟回斩/},
  enjo:{label:'星页回响',delta:'每3次命中 → 扩散震波',detail:'从原施法点扩散至150范围，每个目标14点；不穿墙、不递归。',tactic:/扩散震波/},
});
const ROLES=Object.keys(ECHO);
// Runtime modules live in the harness realm, so compare them as plain data.
const data=value=>JSON.parse(JSON.stringify(value));

function fixture() {
  const e=loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const content=e.loadRuntime('utils/publicBuildContent.mjs');
  return {e,...content,build:(id,choices=[])=>{
    const model=content.getPublicBuildModel(null,id,choices);
    assert(model,`${id} build ${choices.join('+')} must exist`);
    return model;
  }};
}

test('echo option presents the role label with its authoritative delta and detail',()=>{
  const f=fixture();
  for(const role of ROLES)for(const first of ['wide_brush','relay','tempo']){
    const option=f.getPublicBuildOption(f.build(role,[first]),'echo');
    assert.deepEqual(Object.keys(option).sort(),['after','delta','detail','id','label']);
    assert.equal(option.id,'echo');
    assert.equal(option.label,ECHO[role].label);
    assert.equal(option.delta,ECHO[role].delta);
    assert.equal(option.detail,ECHO[role].detail);
    assert.match(option.after.tactic,ECHO[role].tactic);
  }
  assert.equal(f.getPublicBuildOption(f.build('sakura',['fanfire']),'echo').label,'回响追加');
});

test('echo keeps its choice identity and leaves pre and post choices as IDs',()=>{
  const f=fixture();
  for(const role of ROLES){
    const build=f.build(role,['relay']),option=f.getPublicBuildOption(build,'echo');
    assert.deepEqual(data(build.choices),['relay']);
    assert.deepEqual(data(option.after.choices),['relay','echo']);
    assert.equal(option.after.performerId,role);
    assert.equal(option.after.effects.echo,true);
    assert.deepEqual(data(f.build(role,['relay','echo']).choices),['relay','echo']);
    assert.equal(f.getPublicBuildOption(f.build(role),'echo'),null);
    assert.equal(f.getPublicBuildOption(f.build(role,['relay','echo']),'echo'),null);
  }
});

test('choosing echo changes no number and the choice pool uses the same role label',()=>{
  const f=fixture();
  for(const role of ROLES){
    const build=f.build(role,['relay']),option=f.getPublicBuildOption(build,'echo');
    assert.equal(build.effects.echo,false);
    assert.deepEqual({...data(option.after.effects),echo:false},data(build.effects));
    assert.deepEqual(data(option.after.rows),data(build.rows));
    const pool=new f.e.profile.PublicRunProgression({performerId:role,choices:['relay']}).getOptions();
    assert.deepEqual(data(pool.map(({id,label})=>[id,label])),[['echo',ECHO[role].label],['overdrive','超载演出'],['recovery','设施回响']]);
  }
});

test('other option labels stay unchanged for every role',()=>{
  const f=fixture();
  for(const role of ROLES){
    const first=f.build(role),second=f.build(role,['relay']);
    assert.equal(f.getPublicBuildOption(first,'wide_brush').label,'宽幅涂染');
    assert.equal(f.getPublicBuildOption(first,'relay').label,'接力涂染');
    assert.equal(f.getPublicBuildOption(first,'tempo').label,'节拍蓄能');
    assert.equal(f.getPublicBuildOption(second,'overdrive').label,'超载演出');
    assert.equal(f.getPublicBuildOption(second,'recovery').label,'设施回响');
  }
  assert.equal(f.getPublicBuildOption(f.build('sakura'),'fanfire').label,'分轨齐射');
});

test('choice review uses the matching role label and unchanged counters',()=>{
  const f=fixture();
  for(const role of ROLES){
    const build=f.build(role,['relay','echo']),label=ECHO[role].label;
    assert.deepEqual(data(f.getPublicChoiceReview(build,{relay:2,echo:3})),[
      {id:'relay',label:'接力涂染',text:'额外接力 2 次'},
      {id:'echo',label,text:'回响释放 3 次（释放次数，不是命中数）'},
    ]);
    assert.equal(f.getPublicBuildOption(f.build(role,['relay']),'echo').label,label);
    assert.deepEqual(data(f.getPublicChoiceReview(f.build(role,['tempo','echo']),{tempo:1.5,echo:0})),[
      {id:'tempo',label:'节拍蓄能',text:'额外行动充能 1.5 点'},
      {id:'echo',label,text:'回响释放 0 次（释放次数，不是命中数）'},
    ]);
    assert.deepEqual(data(f.getPublicChoiceReview(f.build(role,['relay','recovery']),{relay:1,recovery:1})),[
      {id:'relay',label:'接力涂染',text:'额外接力 1 次'},
      {id:'recovery',label:'设施回响',text:'恢复生命 1 点'},
    ]);
    assert.deepEqual(data(f.getPublicChoiceReview(build,{relay:2,echo:-1})),[]);
    assert.deepEqual(data(build.choices),['relay','echo']);
  }
});

test('presenting echo does not write labels or anything else into the profile',()=>{
  const f=fixture(),before=data(f.e.profile.loadPublicProfile());
  for(const role of ROLES){
    f.getPublicBuildOption(f.build(role,['relay']),'echo');
    f.getPublicChoiceReview(f.build(role,['relay','echo']),{relay:0,echo:0});
  }
  assert.deepEqual(data(f.e.profile.loadPublicProfile()),before);
});
