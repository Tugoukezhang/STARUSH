import test from'node:test';import assert from'node:assert/strict';import{StreetPaintSurface}from'../src/systems/StreetRestorationSurface.mjs';
function fixture(marked){
 const filters=[],pixels=new Uint8ClampedArray(512*512*4).fill(255),scratch={width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data:pixels,width:512,height:512})})};
 const texture={context:{createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},setFilter:v=>filters.push(v)};
 const image={setOrigin(){return this},setDisplaySize(){return this},setDepth(){return this},setAlpha(){return this},setBlendMode(){return this},destroy(){}};
 const materialScratch={width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(1254*1254*4).fill(255),width:1254,height:1254})})};
 const source=key=>key==='three-cast-comic-material'?{width:1254,height:1254,ownerDocument:{createElement:()=>materialScratch}}:{width:512,height:512,ownerDocument:{createElement:()=>scratch}};
 const scene={_userCastPresentation:marked,battleData:{performerId:'sakura',practiceMode:true},_isPublicStage1Round:()=>true,textures:{exists:()=>true,get:key=>({getSourceImage:()=>source(key)}),createCanvas:()=>texture,remove(){}},add:{image:()=>image}};
 return {surface:new StreetPaintSurface(scene,()=>[],100,100),filters};
}
test('only authored compact ground selects Phaser LINEAR texture filtering, keeping native raster resolution',()=>{
 const {surface,filters}=fixture(true);assert.deepEqual(filters,[0]);assert.equal(surface.raster.pixelWidth,50);assert.equal(surface.raster.pixelHeight,50);surface.destroy();
});
test('legacy ground leaves the existing filtering untouched',()=>{const {surface,filters}=fixture(false);assert.deepEqual(filters,[]);surface.destroy();});
