"""Run with blender -b -P build.py. Units are portrait pixels divided by 100."""
import hashlib
import json
import math
from pathlib import Path

import bpy

root = Path(__file__).resolve().parent
source = root.parent / 'blue-white-rebuild-20261123'
layers = json.loads((source / 'raster-layers.json').read_text())['layers']
review = json.loads((source / 'visual-review.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rig = bpy.data.objects.new('Head XYZ', None)
scene.collection.objects.link(rig)
for axis, limit in [('Yaw', 12), ('Pitch', 8), ('Roll', 4)]:
    rig[axis] = 0.0
    rig.id_properties_ui(axis).update(min=-limit, max=limit, description=axis+' (degrees)')

def head_weight(layer, x, y):
    if layer.startswith(('rear-hair', 'hair-back','braid-')):
        return max(0, min(1, (550-y)/160)) * max(0, 1-abs(x-500)/580)
    if layer.startswith(('face','eye','iris','lash','brow','mouth','nose','cap','hat-','hair-','fringe','neck-foundation')) or layer=='neck':
        return max(0, min(1, (435-y)/45))
    return 0

def displaced(name, x, y, axis, sign):
    weight = head_weight(name,x,y)
    rx, ry = x-501, y-382
    # Crown and forehead project as a curved volume. Neck fades into the collar.
    radial = ((x-501)/180)**2 + ((y-290)/200)**2
    depth = 22 + 46 * max(0, 1-radial)
    if name.startswith(('nose','mouth','iris','eye','lash','brow')):
        depth += 5
    if name.startswith(('hat','cap','fringe')):
        depth += 4
    angle = math.radians(sign * {'Yaw':12,'Pitch':8,'Roll':4}[axis])
    c, s = math.cos(angle), math.sin(angle)
    if axis=='Yaw':
        dx, dy = rx*(c-1)+depth*s, 0
    elif axis=='Pitch':
        dx, dy = 0, ry*(c-1)-depth*s
    else:
        dx, dy = rx*(c-1)-ry*s, rx*s+ry*(c-1)
    return weight*dx/100, -weight*dy/100

for order, layer in enumerate(layers):
    name = layer['id']
    path = source/layer['file']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==review['layerSha256'][name]
    x,y,w,h = (layer[k] for k in ('x','y','width','height'))
    moving = any(head_weight(name,x+w*u/4,y+h*v/4)>0 for u in range(5) for v in range(5))
    cols,rows = (max(2,math.ceil(w/28)),max(2,math.ceil(h/28))) if moving else (1,1)
    uv = [(i/cols,1-j/rows) for j in range(rows+1) for i in range(cols+1)]
    points = [(x+u*w,y+(1-v)*h) for u,v in uv]
    verts = [(px/100,-py/100,order*.001) for px,py in points]
    faces = []
    for j in range(rows):
        for i in range(cols):
            a=j*(cols+1)+i
            faces.append((a,a+cols+1,a+cols+2,a+1))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    coords=mesh.uv_layers.new()
    for loop in mesh.loops:
        coords.data[loop.index].uv=uv[loop.vertex_index]
    im=bpy.data.images.load(str(path))
    im.pack()
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    nodes.clear()
    links=mat.node_tree.links
    tex=nodes.new('ShaderNodeTexImage')
    tex.image=im
    tex.extension='CLIP'
    emit=nodes.new('ShaderNodeEmission')
    transparent=nodes.new('ShaderNodeBsdfTransparent')
    mix=nodes.new('ShaderNodeMixShader')
    output=nodes.new('ShaderNodeOutputMaterial')
    links.new(tex.outputs['Color'],emit.inputs['Color'])
    links.new(tex.outputs['Alpha'],mix.inputs[0])
    links.new(transparent.outputs[0],mix.inputs[1])
    links.new(emit.outputs[0],mix.inputs[2])
    links.new(mix.outputs[0],output.inputs['Surface'])
    mesh.materials.append(mat)
    if moving:
        obj.shape_key_add(name='Basis')
        for axis,limit in [('Yaw',12),('Pitch',8),('Roll',4)]:
            for sign in (-1,1):
                key=obj.shape_key_add(name=f'{axis} {sign*limit:+}')
                for vertex,(px,py) in zip(key.data,points):
                    dx,dy=displaced(name,px,py,axis,sign)
                    vertex.co.x+=dx
                    vertex.co.y+=dy
                driver=key.driver_add('value').driver
                var=driver.variables.new()
                var.name='angle'
                var.targets[0].id=rig
                var.targets[0].data_path=f'["{axis}"]'
                driver.expression=f'max(0,min(1,angle*{sign}/{limit}))'

camera=bpy.data.cameras.new('Portrait')
cam=bpy.data.objects.new('Portrait',camera)
scene.collection.objects.link(cam)
cam.location=(5.425,-7.25,10)
camera.type='ORTHO'
camera.ortho_scale=14.5
scene.camera=cam
scene.render.engine='CYCLES'
scene.cycles.samples=48
scene.cycles.transparent_max_bounces=100
scene.cycles.use_denoising=False
scene.render.film_transparent=True
scene.render.resolution_x=1085
scene.render.resolution_y=1450
scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard'
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.color_type='TEXTURE'
            area.spaces.active.overlay.show_overlays=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'blue-head.blend'),compress=True)
