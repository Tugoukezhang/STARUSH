export class PhaserRigView{
 constructor(scene,key){this.scene=scene;this.key=key;this.nodes=[];this.disposed=false;}
 render(rows,depth=10){
  if(this.disposed)return false;
  for(let i=0;i<rows.length;i++){
   const p=rows[i],node=this.nodes[i]??(this.nodes[i]=this.scene.add.image(0,0,this.key,p.part));
   node.setTexture(this.key,p.part).setPosition(p.x,p.y).setDisplaySize(p.width,p.height)
    .setOrigin(...p.origin).setAngle(p.angle).setDepth(depth+i*.00001).setVisible(true);
  }
  for(let i=rows.length;i<this.nodes.length;i++)this.nodes[i].setVisible(false);
  return true;
 }
 destroy(){if(this.disposed)return;this.disposed=true;for(const node of this.nodes)node.destroy();this.nodes=[];}
}
