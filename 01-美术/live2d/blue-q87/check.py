"""Run after opening blue-head.blend; outputs rendered views to Q87_SCRATCH."""
from itertools import product
import os
from pathlib import Path
import bpy

scene=bpy.context.scene
rig=bpy.data.objects['Head XYZ']
parts=[o for o in scene.objects if o.type=='MESH']
assert len(parts)==93 and all(i.packed_file for i in bpy.data.images if i.type=='IMAGE' and i.source=='FILE')
animated=[o for o in parts if o.data.shape_keys]
def pose(yaw,pitch,roll):
    for key,value in zip(('Yaw','Pitch','Roll'),(yaw,pitch,roll)):
        rig[key]=value
    rig.update_tag()
    bpy.context.view_layer.update()
for yaw,pitch,roll in product((-12,-6,0,6,12),(-8,0,8),(-4,0,4)):
    pose(yaw,pitch,roll)
    for obj in animated:
        keys=obj.data.shape_keys.key_blocks
        for axis,value,limit in [('Yaw',yaw,12),('Pitch',pitch,8),('Roll',roll,4)]:
            for sign in (-1,1):
                assert abs(keys[f'{axis} {sign*limit:+}'].value-max(0,sign*value/limit))<1e-5
        evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        assert all(p.normal.z>0.99 for p in evaluated.data.polygons),obj.name
out=Path(os.environ['Q87_SCRATCH'])
out.mkdir(parents=True,exist_ok=True)
scene.render.resolution_percentage=45
for name,angles in [('neutral',(0,0,0)),('left',(-12,8,-4)),('right',(12,-8,4))]:
    pose(*angles)
    scene.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
print('Q87_REOPEN',len(parts),len(animated),'45 poses checked')
