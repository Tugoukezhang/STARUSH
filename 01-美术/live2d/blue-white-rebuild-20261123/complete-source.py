"""Reviewed vector ownership and image-tool donor registration; no raster painting.

All coordinates are on the confirmed 1085 x 1450 portrait. The underlying
PNG donors remain immutable. Source parts are exported by native Inkscape.
"""
import math

def ellipse(cx,cy,rx,ry,n=40):
    return [[round(cx+rx*math.cos(i*2*math.pi/n),3),round(cy+ry*math.sin(i*2*math.pi/n),3)] for i in range(n)]

def revise(spec):
    patches={
      'face':[(444,302),(455,293),(469,283),(480,269),(480,293),(482,310),(487,320),(495,320),(509,315),(525,302),(539,281),(541,300),(546,315),(550,324),(552,340),(549,348),(541,354),(537,361),(533,364),(540,362),(536,366),(528,366),(533,370),(529,377),(521,383),(512,387),(501,390),(489,393),(482,396),(476,394),(467,388),(456,380),(447,372),(440,362),(437,353),(439,346),(444,344),(449,344),(443,340),(439,335),(437,330),(440,318)],
      'eye-left':[(439,306),(448,300),(461,298),(473,300),(481,305),(487,314),(482,315),(478,326),(467,329),(454,326),(445,321)],
      'eye-right':[(518,330),(525,323),(535,322),(546,326),(552,335),(552,342),(546,347),(535,351),(525,346),(518,340)],
      'brow-left':[(456,281),(465,280),(475,283),(484,287),(490,291),(485,290),(475,286),(465,283),(458,284)],
      'brow-right':[(531,300),(540,301),(549,305),(555,310),(552,311),(543,306),(534,303)],
      'mouth':[(476,356),(480,353),(486,354),(495,358),(502,361),(506,365),(503,372),(499,376),(491,378),(483,372),(478,365)],
      'neck':[(450,378),(468,391),(482,397),(496,394),(480,403),(469,407),(466,412),(460,408),(452,404)],
      'corset':[(426,574),(437,560),(458,550),(484,541),(514,536),(539,538),(555,545),(556,569),(567,590),(592,610),(576,629),(554,651),(526,674),(493,663),(470,653),(458,641),(449,623),(438,601)],
      'blouse':[(383,456),(414,436),(442,419),(469,411),(508,404),(542,416),(560,451),(566,481),(559,516),(550,545),(514,548),(480,561),(448,582),(437,606),(417,596),(403,569),(387,540),(379,505)],
      'sleeve-raised':[(545,411),(571,395),(595,385),(609,371),(623,371),(634,351),(645,344),(664,345),(675,331),(685,327),(703,334),(710,341),(696,347),(686,354),(677,363),(675,380),(680,393),(693,402),(707,404),(718,399),(723,410),(718,418),(704,429),(696,437),(689,440),(681,437),(672,440),(660,436),(649,436),(641,440),(625,447),(611,453),(594,460),(576,467),(559,477),(551,484),(544,470),(541,442)],
      'book-ribbon':[(240,1045),(249,1043),(254,1048),(262,1057),(271,1068),(280,1081),(284,1093),(291,1107),(301,1122),(313,1135),(321,1141),(304,1136),(291,1129),(283,1125),(281,1135),(272,1127),(262,1111),(257,1095),(252,1078),(246,1063),(241,1054)],
    }
    patches.update({
      'face':[(449,303),(457,295),(468,289),(478,284),(482,291),(483,309),(486,319),(493,323),(500,325),(507,323),(516,325),(526,319),(533,310),(541,308),(547,320),(551,334),(547,347),(540,355),(535,361),(531,365),(535,368),(529,377),(518,383),(506,389),(491,393),(483,395),(476,391),(465,383),(455,374),(447,365),(443,356),(443,349),(450,345),(453,342),(448,337),(446,331),(447,320)],
      'eye-left':[(435,303),(445,296),(458,294),(473,295),(483,302),(491,313),(487,321),(479,330),(464,332),(449,327),(439,318)],
      'eye-right':[(513,329),(523,319),(539,318),(550,326),(557,338),(552,349),(537,354),(524,350),(516,342)],
      'mouth':[(473,354),(480,350),(489,353),(501,359),(509,365),(506,374),(498,381),(487,380),(479,373),(474,364)],
      'braid-left':[(424,337),(444,350),(438,375),(424,395),(420,411),(405,429),(399,441),(381,458),(367,469),(354,483),(343,492),(338,506),(326,519),(319,533),(307,529),(307,513),(302,508),(310,492),(325,479),(335,465),(353,451),(370,436),(382,420),(391,405),(398,388),(407,370),(416,351)],
      'braid-right':[(541,378),(556,374),(570,382),(568,395),(557,403),(553,415),(545,425),(547,436),(550,442),(545,454),(539,462),(547,473),(542,484),(532,491),(522,486),(520,474),(516,463),(520,452),(512,444),(513,434),(516,421),(522,412),(525,399),(532,390)],
    })
    spec=[(i,l,patches.get(i,p)) for i,l,p in spec]
    additions=[
      ('lash-left','左眼上睫毛','eye-left',[(437,307),(441,303),(446,302),(450,298),(457,296),(463,297),(470,298),(478,302),(482,307),(487,312),(488,315),(484,314),(480,309),(474,306),(466,304),(458,305),(452,307),(448,310),(445,318),(443,316),(442,311),(439,311)]),
      ('lash-right','右眼上睫毛','eye-right',[(518,330),(522,325),(526,323),(533,323),(539,324),(545,327),(548,330),(551,334),(553,339),(552,344),(549,342),(546,335),(540,331),(535,329),(528,329),(524,331),(520,335),(518,337)]),
      ('iris-left','左眼瞳孔','eye-left',ellipse(461.5,314.2,10.8,12.1)),
      ('iris-right','右眼瞳孔','eye-right',ellipse(530.5,338.2,9.8,10.7)),
      ('neck-bow-tail-left','领结左侧蓝白垂带','blouse',[(433,460),(447,466),(441,478),(427,487),(418,502),(406,518),(392,538),(379,527),(366,520),(354,507),(351,496),(366,490),(391,483),(414,474)]),
      ('collar','蓝白立领','neck',[(446,394),(453,397),(467,407),(474,402),(501,394),(528,385),(537,392),(532,408),(513,425),(490,433),(469,437),(449,430),(442,416)]),
    ]
    for i,l,b,p in additions:spec.insert(next(n for n,s in enumerate(spec) if s[0]==b),(i,l,p))
    return spec

def foundations():
    out=[]
    def add(i,label,file,region,matrix,owner):
        out.append(dict(id=i,label=label,file=file,region=region,exclude=[],sourceTransform=matrix,controlOwner=owner,visible=True,accepted=False,clipToSourceAlpha=True,kind='generated-occlusion-underpaint'))
    # Back hair has a complete continuous central mass. Only actual hair pixels
    # are sampled; the donor's unwanted featureless face is outside these UVs.
    add('hair-crown-foundation','帽下完整发顶','hair-underpaint-candidate.png',[(399,244),(409,217),(438,192),(478,181),(523,188),(561,204),(585,234),(599,276),(586,302),(561,304),(528,292),(484,284),(440,304),(408,297)],[1,0,0,1,17,-18],'fringe-center')
    add('hair-back-foundation','双肩后完整发根','hair-underpaint-candidate.png',[(316,342),(400,321),(434,361),(475,393),(529,399),(576,362),(630,399),(690,465),(704,532),(638,579),(548,610),(440,591),(352,542),(308,463)],[1.03,0,0,.97,0,0],'rear-hair-right-upper')
    # One opaque interior restores cloth behind both legs; folds remain from the
    # image-tool donor rather than flat-color geometry.
    add('skirt-interior-foundation','交叠双腿后的完整内裙','dress-complete-paint.png',[(462,664),(536,651),(624,668),(704,696),(777,728),(807,787),(796,848),(751,897),(699,968),(659,1030),(603,1082),(537,1056),(482,990),(434,944),(378,895),(373,832),(408,757)],[.43,0,0,.49,270,650],'skirt-inner-right')
    add('blouse-foundation','领结和前辫后的完整上衣','torso-complete-paint.png',[(390,466),(420,426),(452,404),(492,400),(533,396),(566,418),(582,466),(575,512),(553,555),(506,575),(464,593),(424,574),(393,536)],[.34,0,0,.34,267,293],'blouse')
    add('corset-foundation','挂件和飘带后的完整束腰','torso-complete-paint.png',[(428,558),(476,534),(525,526),(553,543),(556,571),(578,597),(602,614),(573,650),(532,681),(490,666),(454,640)],[.34,0,0,.34,267,293],'corset')
    add('neck-foundation','下巴与衣领之间的完整颈部','face-foundation-paint.png',[(450,371),(478,380),(507,377),(528,369),(524,405),(506,426),(471,434),(449,411)],[.103,0,0,.09,416,343],'neck')
    # Complete original white sleeve plus rounded shoulder and cuff overlap.
    add('raised-sleeve-foundation','右白袖的完整肩端与袖口底面','sleeve-complete-paint.png',[(534,406),(558,384),(582,386),(608,375),(638,346),(668,330),(696,335),(717,362),(724,400),(710,428),(679,444),(639,460),(594,484),(556,497),(534,466)],[.16177135716271948,.00940757095043939,.032370352750407776,.18462693017692805,509.7168280940624,294.081656241729],'sleeve-raised')
    add('raised-shoulder-foundation','右肩与上衣连接底面','torso-complete-paint.png',[(526,395),(550,379),(576,381),(601,409),(597,450),(578,481),(549,496),(527,461)],[.34,0,0,.34,267,293],'blouse')
    # Both dark cuffs extend underneath the white ruffles and wrist attachment.
    add('raised-cuff-foundation','右袖口腕部连接','torso-complete-paint.png',[(682,344),(706,334),(741,313),(768,321),(778,349),(771,372),(743,390),(713,411),(688,408),(673,387)],[.27,.02,-.005,.27,393,310],'cuff-raised')
    add('lowered-sleeve-foundation','左白袖完整肩端','torso-complete-paint.png',[(365,504),(395,508),(415,534),(412,566),(391,606),(368,640),(337,673),(307,689),(282,676),(274,648),(300,606),(335,552)],[.34,0,0,.34,267,293],'sleeve-lowered')
    add('lowered-cuff-foundation','左袖口腕部连接','torso-complete-paint.png',[(231,651),(259,639),(284,647),(297,670),(282,693),(251,713),(222,716),(211,697),(216,676)],[.34,0,0,.34,187,315],'cuff-lowered')
    # Registered full skin oval. Original face color and all features are above.
    add('face-foundation','完整脸部与五官底面','face-foundation-paint.png',[(418,252),(438,229),(472,219),(514,221),(552,238),(579,270),(586,308),(573,341),(553,366),(531,384),(507,395),(482,401),(455,382),(435,357),(420,327)],[.20278934746939287,-.02610122428373096,.013719550675249272,.18202700997097057,364.1545500441752,229.00176700744672],'face')
    add('eye-white-left-foundation','左眼白完整底面','eye-components-paint.png',ellipse(462,313,18,14),[.075,.012,-.016,.08,441,279],'eye-left')
    add('eye-white-right-foundation','右眼白完整底面','eye-components-paint.png',ellipse(533,337,16,12),[.066,.016,-.018,.07,474,297],'eye-right')
    add('iris-left-foundation','左瞳孔完整底面','eye-components-paint.png',ellipse(461.5,314,10.8,13),[.047,0,0,.057,445.5,264.4],'iris-left')
    add('iris-right-foundation','右瞳孔完整底面','eye-components-paint.png',ellipse(530.5,338,9.8,11.4),[.043,0,0,.050,488.8,294.5],'iris-right')
    add('book-cover-foundation','书签后的连续蓝金书封','book-complete-paint.png',[(234,1041),(250,1038),(268,1054),(282,1074),(290,1088),(275,1094),(250,1088),(238,1065)],[.235,0,0,.255,69,867],'book')
    # Use undecorated image-tool materials for occluded interiors. Complete
    # clothing donors above are retained as provenance, but their invented trim
    # and repeated buttons must not appear in the character's hidden surfaces.
    quadrants={'white':(100,100,450,450),'navy':(710,100,450,450),'blue':(100,710,450,450),'pink':(710,710,450,450)}
    def material(layer,kind):
        x,y,w,h=quadrants[kind];p=layer['region'];x0=min(v[0] for v in p)-8;y0=min(v[1] for v in p)-8
        sx=(max(v[0] for v in p)-x0+8)/w;sy=(max(v[1] for v in p)-y0+8)/h
        layer.update(file='material-underpaint-sheet.png',sourceTransform=[sx,0,0,sy,x0-x*sx,y0-y*sy])
    byid={p['id']:p for p in out}
    for i in ['blouse-foundation','raised-shoulder-foundation','raised-sleeve-foundation','lowered-sleeve-foundation']:material(byid[i],'white')
    for i in ['corset-foundation','raised-cuff-foundation','lowered-cuff-foundation']:material(byid[i],'navy')
    material(byid['skirt-interior-foundation'],'blue')
    byid['skirt-interior-foundation']['region']=[(449,693),(526,667),(617,682),(704,712),(777,747),(823,786),(820,845),(797,895),(751,932),(708,977),(664,1010),(611,1004),(546,967),(482,936),(419,898),(378,857),(386,805),(414,748)]
    material(byid['skirt-interior-foundation'],'blue')
    byid['hair-crown-foundation'].pop('controlOwner')
    byid['hair-back-foundation'].pop('controlOwner')
    byid['hair-crown-foundation']['region']=[(399,244),(409,217),(438,192),(478,181),(523,188),(561,204),(585,234),(599,267),(577,281),(545,275),(516,267),(481,265),(448,277),(418,293),(404,276)]
    byid['neck-foundation']['region']=[(451,372),(477,383),(506,379),(522,374),(520,401),(503,414),(473,418),(451,406)]
    byid['face-foundation']['region']=[(418,252),(438,229),(472,219),(514,221),(552,238),(579,270),(581,306),(568,337),(551,361),(532,378),(515,387),(498,392),(483,396),(470,387),(456,375),(446,362),(437,344),(425,321)]
    byid['face-foundation']['file']='face-foundation-final.png'
    byid['book-cover-foundation']['region']=[(237,1043),(251,1040),(269,1057),(282,1076),(285,1084),(270,1088),(255,1088),(243,1065)]
    byid['book-cover-foundation']['sourceTransform']=[.235,0,0,.28,69,832]
    # A stationary crown stays behind the moving fringe and above the face.
    out.remove(byid['hair-crown-foundation']);out.insert(out.index(byid['face-foundation'])+1,byid['hair-crown-foundation'])
    add('straight-leg-foundation','后腿在交叠处的完整白袜','material-underpaint-sheet.png',[(541,813),(569,807),(595,838),(624,875),(650,917),(676,957),(654,976),(625,949),(592,911),(564,868),(541,841)],[1,0,0,1,0,0],'stocking-straight')
    material(out[-1],'white')
    add('bent-thigh-foundation','裙摆下的大腿连接底面','face-foundation-final.png',ellipse(564,793,66,63),[.17,0,0,.15,449,710],'thigh-bent')
    add('raised-wrist-foundation','右手袖内腕部','face-foundation-final.png',[(743,321),(762,308),(782,325),(792,349),(774,368),(753,363),(742,345)],[.09,0,0,.08,705,291],'raised-hand')
    add('lowered-wrist-foundation','左手袖内腕部','face-foundation-final.png',[(197,674),(214,665),(234,675),(238,695),(222,710),(206,713),(195,696)],[.07,0,0,.065,170,650],'lowered-hand')
    add('fringe-center-foundation','中央刘海完整遮挡底面','hair-underpaint-candidate.png',[(424,242),(444,225),(474,210),(513,209),(548,221),(569,245),(567,274),(551,301),(528,323),(502,325),(481,307),(459,291),(441,314),(423,309)],[1,0,0,1,17,-18],'fringe-center')
    material(out[-1],'pink')
    material(byid['hair-back-foundation'],'pink')
    for i,label,owner,region in [
      ('hair-left-root-foundation','花饰和帽带下的左发根','hair-side-left',[(364,256),(395,237),(426,256),(444,297),(440,338),(422,370),(393,382),(364,352),(351,306)]),
      ('fringe-right-foundation','右鬓发完整底面','fringe-right',[(548,217),(574,225),(594,250),(608,282),(617,304),(625,308),(619,318),(611,336),(612,357),(595,382),(576,393),(558,380),(570,349),(572,320),(552,311),(562,284)]),
      ('braid-left-foundation','左前辫遮挡连接','braid-left',[(419,343),(438,356),(432,377),(418,397),(411,417),(397,438),(375,459),(355,483),(338,499),(325,521),(314,526),(308,513),(318,488),(340,466),(366,444),(385,416),(399,386)]),
      ('braid-right-foundation','右前辫遮挡连接','braid-right',[(541,378),(562,380),(566,394),(553,419),(546,437),(541,457),(547,476),(535,490),(524,483),(519,464),(520,444),(519,425),(528,403)]),
    ]:
        add(i,label,'material-underpaint-sheet.png',region,[1,0,0,1,0,0],owner);material(out[-1],'pink')
    return out

# Actual painter's order, bottom to top. Visible pixel ownership is independent
# of draw order. Complete foundations sit directly below the parts they extend.
Z_ORDER=[
 'hair-back-foundation','rear-hair-right-lower','rear-hair-left-lower','rear-hair-left-upper','rear-hair-right-upper','hair-under-raised-sleeve',
 'skirt-lower-train','skirt-left-back','skirt-inner-right','stocking-straight','shoe-straight','thigh-bent','stocking-bent','shoe-bent',
 'coat-left-back','coat-right-back','coat-right-tail','sleeve-lowered','sleeve-raised','blouse','corset','skirt-front','skirt-right',
 'neck','collar','face','eye-left','iris-left','lash-left','eye-right','iris-right','lash-right','brow-left','brow-right','nose','mouth',
 'hair-side-left','ear-left','hair-crown-foundation','fringe-center','fringe-right','hair-temple-left','hair-temple-right',
 'cap','hat-bow','hat-bow-tails','hat-flower','hair-gold-clips','braid-left','braid-right','neck-bow','neck-bow-tail-left','neck-bow-tail-right',
 'cuff-lowered','cuff-raised','lowered-hand','raised-hand','waist-bow','waist-star','ribbon-side-right','ribbon-lower-left','ribbon-front-long',
 'book','book-ribbon','bird','ribbon-airborne','ribbon-top-drop',
]

def arrange(rows):
    by={l['id']:l for l in rows};result=[]
    for key in Z_ORDER:
        for l in rows:
            if l['kind']=='generated-occlusion-underpaint' and l.get('controlOwner')==key and l['id'] not in Z_ORDER:
                result.append(l)
        if key in by:result.append(by[key])
    assert len(result)==len(rows),(set(by)-set(l['id'] for l in result))
    return result
