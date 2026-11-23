"""Import the exported layers in GIMP 3, save XCF/PSD and reopen both.

Run inside GIMP's python-fu-eval. This only packages/inspects native layers;
it does not paint, repair or manufacture image pixels.
STARUSH_Q86_ROOT must name this source directory; evidence goes outside Git.
"""
from pathlib import Path
import os, json, hashlib
from gi.repository import Gimp, Gio

root = Path(os.environ['STARUSH_Q86_ROOT']).resolve()
scratch = Path(os.environ.get('STARUSH_Q86_SCRATCH', '/tmp/starush-q86'))
scratch.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root/'raster-layers.json').read_text())
expected = list(reversed(manifest['layers']))

def load(path):
    image = Gimp.file_load(Gimp.RunMode.NONINTERACTIVE, Gio.File.new_for_path(str(path)))
    assert image is not None, str(path)
    return image

def export(image, procedure, target):
    proc = Gimp.get_pdb().lookup_procedure(procedure)
    config = proc.create_config()
    config.set_property('run-mode', Gimp.RunMode.NONINTERACTIVE)
    config.set_property('image', image)
    config.set_property('file', Gio.File.new_for_path(str(target)))
    result = proc.run(config)
    assert result.index(0) == Gimp.PDBStatusType.SUCCESS, (procedure, result.index(0))

def inspect(image, name):
    assert (image.get_width(), image.get_height()) == (1085,1450)
    layers = image.get_layers()
    assert len(layers) == len(expected), (name,len(layers))
    entries=[]
    for layer, row in zip(layers, expected):
        assert layer.get_name() == row['id'], (name,layer.get_name(),row['id'])
        assert (layer.get_width(),layer.get_height()) == (row['width'],row['height'])
        offsets=layer.get_offsets()
        assert tuple(offsets[-2:]) == (row['x'],row['y']), (name,offsets,row)
        assert bool(layer.get_visible()) == row['visible']
        # Every native layer must accept isolated movement and visibility edits.
        layer.set_visible(not row['visible'])
        assert bool(layer.get_visible()) != row['visible']
        layer.set_offsets(row['x']+17,row['y']-13)
        assert tuple(layer.get_offsets()[-2:]) == (row['x']+17,row['y']-13)
        layer.set_offsets(row['x'],row['y'])
        layer.set_visible(row['visible'])
        entries.append({'id':row['id'],'visible':row['visible'],'offsetsRestored':True,'toggleAndMove':True})
    export(image, 'file-png-export', scratch/(name+'-reopened.png'))
    return entries

image=load(root/'blue-white-layer-source.ora')
ora=inspect(image,'ora')
# GIMP's ORA importer maps svg:src-over to modern (linear) NORMAL. PSD and
# browser src-over use perceptual RGB here. Persist classic Normal in the
# recommended XCF/PSD; retain and report the unmodified ORA import separately.
for layer in image.get_layers():layer.set_mode(Gimp.LayerMode.NORMAL_LEGACY)
ora_perceptual=inspect(image,'ora-perceptual')
assert Gimp.file_save(Gimp.RunMode.NONINTERACTIVE,image,Gio.File.new_for_path(str(root/'blue-white-layer-source.xcf')))
export(image,'file-psd-export',root/'blue-white-layer-source.psd')
image.delete()
records={'gimpVersion':Gimp.version(),'canvas':[1085,1450],'layerCount':len(expected),'ora':ora,'oraPerceptual':ora_perceptual,'savedBlendMode':'NORMAL_LEGACY','oraDefaultColorMatchesBrowser':False}
for ext in ['xcf','psd']:
    reopened=load(root/('blue-white-layer-source.'+ext))
    records[ext]=inspect(reopened,ext)
    reopened.delete()
records['files']=[{'file':'blue-white-layer-source.'+ext,'sha256':hashlib.sha256((root/('blue-white-layer-source.'+ext)).read_bytes()).hexdigest()} for ext in ['ora','xcf','psd']]
(scratch/'native-reopen.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print('NATIVE_REOPEN_OK',len(expected), 'layers in ORA, XCF, PSD')
