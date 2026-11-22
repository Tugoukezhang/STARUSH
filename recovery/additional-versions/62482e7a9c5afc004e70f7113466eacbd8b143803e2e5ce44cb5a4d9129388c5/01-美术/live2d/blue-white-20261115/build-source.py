"""Editable UV ownership over immutable image-tool derivatives; no raster painting."""
from pathlib import Path
import json, hashlib, base64, struct
from xml.sax.saxutils import escape
r=Path(__file__).resolve().parent
W,H=1085,1450
# Top to bottom. Each region excludes every region above it, preserving neutral source.
spec=[
 ('ribbon-top-drop','上方独立水滴披带',[(375,45),(635,45),(635,120),(375,120)]),
 ('ribbon-airborne','上方花纹回旋披带',[(635,0),(1085,0),(1085,455),(1000,512),(903,535),(886,513),(987,463),(1020,414),(987,385),(940,318),(862,247),(766,173),(636,115)]),
 ('raised-hand','抬起的右手',[(761,325),(771,310),(786,293),(798,261),(811,262),(815,286),(809,309),(844,321),(865,341),(885,373),(882,388),(865,381),(833,358),(807,350),(821,367),(807,378),(789,371),(773,370),(755,358),(753,344)]),
 ('lowered-hand','左侧伸出的手',[(217,673),(207,668),(180,661),(157,651),(147,655),(154,671),(169,681),(141,681),(136,689),(160,696),(178,696),(170,717),(170,731),(180,734),(196,717),(223,711),(230,690)]),
 ('eye-left','画面左眼',[(442,303),(451,296),(464,297),(480,305),(484,315),(478,326),(462,328),(449,322)]),
 ('eye-right','画面右眼',[(517,327),(524,319),(536,320),(548,328),(550,339),(541,349),(529,349),(521,342)]),
 ('brow-left','画面左眉',[(446,286),(458,283),(473,287),(480,294),(478,297),(463,291),(451,291)]),
 ('brow-right','画面右眉',[(527,307),(539,307),(548,312),(551,319),(546,320),(537,313),(528,312)]),
 ('mouth','嘴部',[(476,353),(485,351),(498,356),(507,363),(506,373),(497,382),(486,376),(478,366)]),
 ('nose','鼻部',[(495,331),(504,335),(507,346),(500,351),(494,346)]),
 ('hat-flower','帽边白花与金饰',[(335,238),(358,224),(382,230),(398,212),(414,216),(425,241),(449,238),(455,253),(435,273),(421,279),(416,300),(397,306),(376,295),(361,306),(345,291),(352,270),(334,265)]),
 ('hair-gold-clips','刘海金色发夹',[(423,245),(438,240),(451,253),(467,259),(462,275),(447,273),(435,266),(421,261)]),
 ('cap','蓝白花帽',[(348,235),(375,205),(413,173),(461,143),(505,126),(547,122),(579,136),(608,168),(630,215),(637,256),(615,285),(598,279),(577,244),(542,215),(506,209),(461,219),(423,245),(396,266)]),
 ('hat-bow','帽侧深蓝蝴蝶结',[(314,251),(345,248),(361,279),(386,292),(417,293),(408,329),(382,353),(340,362),(321,342),(323,314),(300,310),(266,298),(243,309),(222,328),(226,297),(247,276),(282,280),(317,290)]),
 ('hat-bow-tails','帽侧垂带',[(335,329),(376,321),(397,327),(385,363),(362,388),(332,406),(320,388),(311,400),(295,384),(288,367),(300,348)]),
 ('face','脸部可见面',[(424,300),(443,286),(468,294),(490,309),(516,317),(539,310),(565,318),(568,348),(553,374),(535,391),(508,402),(489,400),(466,387),(446,370),(432,348)]),
 ('ear-left','画面左耳',[(414,324),(428,326),(439,345),(442,360),(431,363),(420,352),(411,338)]),
 ('fringe-center','中央刘海',[(425,243),(460,217),(501,208),(544,218),(571,242),(566,275),(550,303),(526,324),(502,322),(479,300),(456,287),(436,313),(423,306)]),
 ('fringe-right','右侧刘海鬓发',[(546,215),(573,224),(593,250),(608,280),(617,304),(630,308),(620,321),(612,334),(611,359),(594,384),(576,394),(560,378),(574,347),(570,319),(550,313),(563,282)]),
 ('braid-left','画面左前辫',[(414,340),(445,359),(433,394),(419,422),(400,451),(379,480),(354,497),(344,523),(328,535),(311,523),(318,496),(333,477),(362,456),(387,425),(396,394)]),
 ('braid-right','画面右前辫',[(546,374),(570,382),(563,411),(555,430),(556,454),(545,471),(553,497),(571,524),(565,545),(541,539),(531,514),(522,489),(526,465),(515,451),(526,429),(529,403)]),
 ('neck-bow','领口蓝色蝴蝶结',[(407,429),(441,430),(455,422),(471,425),(490,412),(519,417),(525,444),(514,460),(495,460),(515,489),(508,504),(482,485),(476,517),(462,531),(450,509),(449,478),(428,489),(405,484),(398,470),(399,447)]),
 ('ribbon-front-long','胸前右侧长披带',[(521,503),(537,526),(542,563),(567,590),(602,588),(662,558),(729,518),(806,474),(858,456),(899,467),(905,486),(885,506),(855,513),(817,533),(759,551),(709,570),(655,594),(614,609),(582,613),(547,596),(530,576),(521,545)]),
 ('waist-star','腰间星盘与挂坠',[(606,613),(634,616),(663,632),(682,654),(679,682),(665,701),(669,718),(653,715),(641,700),(627,699),(618,718),(600,714),(600,693),(585,684),(587,658),(599,643)]),
 ('waist-bow','腰前深蓝蝴蝶结',[(445,648),(473,658),(491,683),(485,707),(468,716),(468,738),(449,762),(421,778),(406,764),(419,741),(423,717),(435,699),(431,675)]),
 ('shoe-bent','弯腿蓝色鞋',[(800,832),(827,827),(851,839),(855,861),(839,875),(864,881),(878,897),(899,944),(903,964),(894,975),(879,972),(862,946),(846,921),(816,905),(802,880),(797,854)]),
 ('stocking-bent','前侧弯腿白袜',[(497,797),(526,796),(557,803),(584,819),(589,836),(576,859),(560,879),(609,862),(668,854),(735,854),(794,850),(809,865),(810,892),(789,909),(733,918),(677,925),(614,941),(564,953),(521,953),(490,939),(477,919),(477,888),(484,855)]),
 ('thigh-bent','前侧大腿皮肤',[(507,751),(538,743),(570,752),(603,756),(636,771),(640,807),(629,839),(604,860),(576,864),(587,832),(571,815),(548,805),(520,803),(497,810),(495,787)]),
 ('shoe-straight','后侧直腿蓝鞋与踝饰',[(800,1261),(826,1256),(849,1233),(870,1241),(893,1261),(898,1290),(884,1304),(883,1330),(893,1355),(879,1388),(850,1418),(827,1425),(816,1407),(805,1372),(808,1347),(801,1322),(791,1300)]),
 ('stocking-straight','后侧直腿白袜',[(576,930),(625,921),(662,936),(686,970),(717,1015),(745,1065),(772,1124),(804,1195),(830,1257),(854,1306),(863,1342),(856,1372),(843,1383),(829,1376),(816,1348),(811,1312),(792,1249),(764,1192),(735,1143),(709,1106),(678,1071),(650,1042),(622,1006),(594,966)]),
 ('cuff-raised','右侧深蓝袖口',[(677,339),(703,335),(736,319),(753,315),(773,332),(762,351),(770,368),(749,382),(730,406),(707,419),(680,409),(662,388),(663,363)]),
 ('sleeve-raised','右侧抬起的白袖',[(549,398),(578,386),(608,375),(639,351),(662,328),(683,332),(694,349),(676,372),(678,397),(703,408),(716,410),(702,434),(674,445),(639,458),(609,478),(578,490),(551,473),(538,438)]),
 ('cuff-lowered','左侧深蓝袖口',[(244,643),(263,634),(288,647),(296,669),(281,686),(250,703),(233,714),(215,706),(212,684),(224,671),(233,655)]),
 ('sleeve-lowered','左侧白袖',[(362,507),(391,511),(407,533),(404,565),(391,596),(373,621),(359,647),(336,673),(315,687),(293,686),(275,671),(270,649),(280,628),(296,605),(313,576),(336,549)]),
 ('neck','颈部',[(453,386),(480,397),(510,401),(530,390),(526,415),(514,429),(490,428),(468,435),(449,420)]),
 ('corset','深蓝束腰',[(406,539),(437,550),(470,545),(499,535),(523,539),(543,565),(559,591),(592,611),(582,638),(554,665),(521,684),(489,679),(455,664),(439,637),(428,601)]),
 ('blouse','白色上衣',[(391,463),(423,457),(457,459),(494,450),(530,459),(556,479),(574,514),(558,545),(535,560),(510,542),(481,550),(447,567),(419,561),(397,540),(382,509)]),
 ('ribbon-side-right','右侧中段飘带',[(613,578),(641,580),(671,602),(704,612),(745,614),(799,613),(842,615),(873,628),(903,642),(908,660),(887,655),(876,644),(851,639),(822,642),(776,661),(745,660),(707,642),(667,629),(637,610)]),
 ('ribbon-lower-left','左下长披带',[(407,708),(433,721),(407,749),(379,766),(340,790),(308,826),(284,867),(259,906),(240,926),(230,918),(242,875),(268,831),(302,794),(341,764),(378,743)]),
 ('skirt-front','前侧蓝白百褶裙',[(486,656),(516,673),(555,660),(593,637),(619,652),(640,679),(668,700),(689,724),(691,753),(674,778),(650,800),(620,793),(599,776),(566,764),(543,755),(514,765),(484,781),(455,795),(431,795),(400,823),(373,833),(345,853),(329,840),(337,814),(359,789),(392,768),(420,745),(453,715)]),
 ('skirt-right','右侧外裙褶',[(650,645),(681,651),(711,662),(747,668),(775,678),(807,687),(834,706),(849,729),(841,756),(818,776),(797,800),(776,818),(750,817),(727,805),(711,786),(689,774),(678,745),(680,714)]),
 ('skirt-inner-right','右侧内裙',[(683,716),(746,721),(796,743),(834,746),(862,740),(880,763),(870,792),(841,815),(832,841),(809,854),(786,872),(753,875),(722,859),(690,854),(658,858),(634,838),(647,795)]),
 ('skirt-left-back','左侧后裙褶',[(395,786),(440,799),(476,780),(502,800),(505,845),(485,878),(484,913),(455,927),(423,921),(401,907),(378,902),(352,897),(333,879),(322,852),(343,826)]),
 ('skirt-lower-train','下方垂落后裙',[(427,905),(484,916),(528,947),(571,945),(609,933),(654,943),(697,951),(724,950),(746,951),(750,979),(735,1009),(702,1026),(684,1060),(664,1084),(639,1103),(608,1106),(607,1140),(589,1163),(557,1166),(528,1155),(501,1155),(474,1142),(449,1127),(421,1104),(422,1084),(441,1061),(439,1036),(418,1017),(402,994),(397,969),(414,941)]),
 ('book-ribbon','书本下方书签飘带',[(222,1039),(245,1041),(262,1056),(270,1082),(289,1112),(315,1137),(302,1145),(278,1132),(259,1135),(246,1117),(244,1096),(233,1075)]),
 ('bird','白蓝小鸟',[(16,738),(219,738),(221,816),(191,842),(185,868),(132,879),(96,867),(20,860)]),
 ('book','悬浮蓝色魔法书',[(80,852),(150,850),(188,844),(232,878),(261,917),(301,929),(349,929),(365,954),(400,975),(406,1013),(397,1042),(411,1076),(388,1094),(322,1098),(268,1100),(208,1082),(161,1066),(130,1038),(106,985),(89,929)]),
 ('rear-hair-left-upper','左侧后发上束',[(32,387),(214,385),(290,449),(350,471),(397,430),(432,386),(439,426),(411,468),(372,501),(327,531),(270,526),(206,498),(155,493),(120,515),(110,557),(123,596),(94,612),(52,576),(32,520)]),
 ('rear-hair-left-lower','左侧后发下束',[(110,491),(210,482),(295,514),(357,502),(393,480),(414,523),(399,575),(373,639),(393,694),(370,717),(328,713),(289,688),(241,671),(192,672),(154,646),(133,600),(134,553)]),
 ('rear-hair-right-upper','右侧后发上束',[(571,411),(632,410),(687,444),(731,452),(793,425),(836,431),(853,452),(891,444),(940,439),(981,464),(976,503),(948,526),(927,556),(869,553),(821,541),(766,551),(716,537),(663,513),(618,479),(587,462)]),
 ('rear-hair-right-lower','右侧后发下束',[(629,492),(685,514),(756,524),(819,523),(875,527),(926,520),(970,539),(1004,575),(1020,616),(1011,650),(983,670),(978,714),(965,754),(942,789),(914,803),(891,789),(898,746),(883,714),(861,692),(839,668),(795,647),(744,632),(702,602),(656,568)])
]
# First isolated-layer audit: correct book/page contamination, palm cutouts and
# the long stocking's right edge. These are UV edits, not raster retouching.
patches={
 'book-ribbon':[(240,1046),(253,1044),(263,1056),(273,1071),(283,1092),(286,1106),(297,1120),(310,1131),(321,1139),(304,1135),(288,1128),(282,1124),(281,1134),(273,1128),(263,1114),(257,1098),(253,1082),(248,1068),(240,1052)],
 'raised-hand':[(752,323),(774,303),(789,282),(798,260),(812,260),(816,282),(810,308),(845,319),(866,340),(887,370),(888,389),(879,392),(851,369),(828,354),(831,371),(816,380),(796,375),(777,373),(763,365),(756,351),(747,342)],
 'bird':[(16,735),(220,735),(219,806),(194,833),(174,848),(169,858),(154,866),(133,861),(123,857),(110,865),(100,861),(105,852),(82,852),(20,858)],
 'braid-right':[(542,379),(555,375),(569,381),(568,393),(553,395),(550,413),(542,425),(541,434),(549,441),(543,453),(535,459),(541,470),(548,477),(541,484),(532,490),(524,483),(523,471),(518,461),(523,452),(516,446),(516,436),(514,430),(519,420),(526,413),(525,402),(531,392)],
 'stocking-straight':[(578,930),(621,922),(652,934),(675,957),(699,988),(723,1020),(745,1056),(768,1096),(791,1141),(813,1188),(833,1234),(850,1271),(859,1307),(868,1344),(861,1376),(844,1387),(826,1378),(814,1349),(808,1314),(798,1272),(781,1230),(760,1187),(738,1148),(713,1111),(686,1078),(659,1047),(635,1017),(613,988),(595,960)],
 'ribbon-airborne':[(635,0),(1085,0),(1085,451),(1035,458),(1017,440),(1020,414),(987,385),(940,318),(862,247),(766,173),(636,115)],
}
# Face boundary traced against fine-face.png at original-canvas coordinates.
# Preserve the old face region's hair samples in a separate editable fringe layer.
old_face=next(p for i,l,p in spec if i=='face')
patches['face']=[(444,299),(449,293),(461,286),(473,284),(479,287),(479,304),(480,315),(476,323),(485,321),(493,322),(500,326),(512,322),(523,315),(530,306),(536,294),(540,287),(541,307),(548,316),(551,326),(551,342),(545,351),(541,357),(551,354),(545,361),(537,364),(545,364),(535,373),(531,376),(538,375),(528,381),(514,385),(494,392),(486,389),(472,379),(460,369),(450,358),(444,348),(442,342),(449,343),(454,340),(446,339),(442,335),(439,327),(440,312)]
spec=[(i,l,patches.get(i,p)) for i,l,p in spec]
spec.insert(next(n for n,s in enumerate(spec) if s[0]=='face')+1,('fringe-face-edge','脸缘刘海与鬓发独立归属',old_face))
spec.insert(next(n for n,s in enumerate(spec) if s[0]=='braid-right')+1,('neck-bow-tail-right','领结右侧蓝白飘带',[(520,491),(536,495),(545,501),(556,510),(571,520),(588,530),(594,540),(584,548),(561,539),(541,536),(525,526),(518,516)]))
spec=[(i,'左侧鬓角发丝（原误标耳朵）' if i=='ear-left' else l,p) for i,l,p in spec]
rows=[]
for n,(id,label,p) in enumerate(spec): rows.append(dict(id=id,label=label,file='cutout-candidate.png',region=p,exclude=[q for _,_,q in spec[:n]],kind='visible-source-UV',accepted=False))
rows.append(dict(id='unassigned-residual',label='待审查的未归属余面',file='cutout-candidate.png',region=[(0,0),(W,0),(W,H),(0,H)],exclude=[p for _,_,p in spec],kind='unassigned-residual',accepted=False))
rows.reverse()
# Coordinates below were inspected in residual-atlas-0..3, not automatically
# assigned by nearest distance. Preserve original pixels and keep ownership explicit.
def box(x,y,w,h):return [(x,y),(x+w,y),(x+w,y+h),(x,y+h)]
transfers=[
 ('coat-left-back',[box(344,547,104,210),box(325,733,97,114)]),
 ('coat-right-back',[box(539,464,117,128),box(656,582,63,33)]),
 ('coat-right-tail',[box(565,601,329,157)]),
 ('hair-side-left',[box(308,276,123,195),box(275,327,49,69)]),
 ('stocking-straight',[box(718,999,153,247)]),
 ('skirt-inner-right',[box(646,915,101,38)]),
 ('thigh-bent',[box(558,795,99,64)]),
 ('stocking-bent',[box(558,859,99,22),box(791,891,77,63)]),
 ('neck',[box(448,363,39,69)]),
 ('hair-side-left',[box(431,363,17,69)]),
 ('ribbon-airborne',[box(968,405,54,58)]),
 ('shoe-bent',[box(837,870,66,85)]),
 ('book-ribbon',[box(265,1097,56,45)]),
 ('fringe-right',[box(541,279,35,102)]),
 ('ribbon-lower-left',[box(231,802,64,87),box(254,890,16,29)]),
 ('rear-hair-left-upper',[box(108,514,28,71)]),
 ('skirt-lower-train',[box(475,1143,50,23),box(589,1147,14,15),box(418,1093,13,20),box(428,1057,15,19)]),
 ('hat-bow',[box(278,301,47,23),box(227,313,11,15)]),
 ('shoe-straight',[box(847,1354,48,67),box(881,1316,16,41),box(871,1241,27,33)]),
 ('sleeve-raised',[box(691,404,41,37),box(676,325,30,15)]),
 ('rear-hair-right-upper',[box(681,437,55,17)]),
 ('skirt-front',[box(478,770,24,27),box(665,691,17,25),box(428,793,21,8)]),
 ('cap',[box(550,122,56,43),box(620,196,12,20)]),
 ('cuff-raised',[box(750,297,27,23),box(747,366,38,18)]),
 ('braid-right',[box(518,386,22,51)]),
 ('rear-hair-right-lower',[box(983,553,35,50)]),
 ('fringe-center',[box(504,207,46,16),box(457,289,30,19)]),
 ('hat-bow-tails',[box(295,384,12,23)]),
 ('lowered-hand',[box(143,675,28,8),box(193,711,23,9),box(145,691,15,7)]),
 ('cuff-lowered',[box(229,704,19,14),box(212,669,14,9)]),
 ('skirt-left-back',[box(323,863,11,15)]),
 ('shoe-bent',[box(833,827,12,10)]),
 ('raised-hand',[box(868,343,13,17),box(826,352,9,9)]),
]
labels={'coat-left-back':'左侧外套后襟','coat-right-back':'右侧外套后襟','coat-right-tail':'右侧外套飘襟','hair-side-left':'帽后左侧长鬓发'}
prior=[]
for owner,regions in transfers:
 layer=next((l for l in rows if l['id']==owner),None)
 if layer is None:
  layer=dict(id=owner,label=labels[owner],file='cutout-candidate.png',region=regions[0],exclude=[regions[0]],kind='visible-source-residual-ownership',accepted=False)
  rows.insert(1,layer)
 layer.setdefault('residualParts',[]).append(dict(regions=regions,exclude=[p for _,_,p in spec]+prior.copy()))
 layer.setdefault('appendResidualRegions',[]).extend(regions)
 prior.extend(regions)
next(l for l in rows if l['id']=='unassigned-residual')['exclude'].extend(prior)
# Inpaint stays off until isolated and shifted inspection proves each boundary.
donors=[
 ('raised-sleeve-complete-candidate','完整右袖补绘替换候选（未启用）','raised-sleeve-isolated.png',[(510,300),(795,300),(795,520),(510,520)],'review-alternative-not-bound'),
 ('book-cover-hidden-paint','书签背后的蓝金书封补绘','book-cover-underpaint.png',[(238,1046),(252,1042),(267,1056),(284,1080),(285,1084),(272,1087),(256,1085),(248,1070)],'book'),
 ('scalp-underpaint','无五官头部皮肤补绘','face-skin-full-canvas.png',[(409,205),(588,205),(588,340),(559,375),(537,391),(510,403),(488,404),(458,386),(435,358),(409,348)],'face'),
 ('neck-chest-underpaint','辫与领结后的颈胸补绘','body-uncovered-underpaint.png',[(439,381),(524,387),(548,432),(548,502),(499,542),(442,553),(404,521),(415,460)],'blouse'),
 ('hair-crown-underpaint','帽后发根候选','hair-underpaint.png',[(397,167),(476,146),(553,167),(601,211),(603,263),(563,281),(514,241),(457,249),(412,281),(389,235)],'fringe-center'),
 ('hair-left-root-underpaint','左后发遮挡连接候选','hair-underpaint.png',[(352,325),(430,330),(436,440),(382,527),(323,545),(300,500)],'rear-hair-left-upper'),
 ('hair-right-root-underpaint','右后发遮挡连接候选','hair-underpaint.png',[(550,355),(615,369),(660,429),(737,476),(790,524),(769,568),(689,538),(609,489),(562,432)],'rear-hair-right-upper'),
 ('inner-skirt-underpaint','交叉双腿后的连续内裙候选','skirt-underpaint.png',[(492,748),(570,728),(655,745),(722,794),(814,825),(845,869),(816,919),(744,974),(662,998),(583,977),(512,950),(473,916),(477,850)],'skirt-inner-right')
]
for id,label,file,p,owner in reversed(donors): rows.insert(0,dict(id=id,label=label,file=file,region=p,exclude=[],kind='generated-hidden-paint',controlOwner=owner,visible=False,accepted=False))
sleeve_candidate=next(l for l in rows if l['id']=='raised-sleeve-complete-candidate')
sleeve_candidate.update(sourceTransform=[0.7072289017191552,-0.014160407587091908,0.014160407587091908,0.7072289017191552,189.80808788121547,64.63350808177098],alternativeTo=['sleeve-raised','cuff-raised'],registrationInliers=13,registrationMedianError=1.305880290772194)
# Continuous visible skin: immutable generated donor blended only under eyes,
# mouth and nose. Feathered original features remain independently movable.
feature_ids=['eye-left','eye-right','mouth','nose']
feature_regions=[next(l['region'] for l in rows if l['id']==i) for i in feature_ids]
face=next(l for l in rows if l['id']=='face')
face['exclude']=[q for q in face['exclude'] if q not in feature_regions]
face['inpaintRegions']=feature_regions
face['inpaintFile']='face-skin-full-canvas.png'
face['inpaintMethod']='SVG donor UV patches, 5px dilation / 2px feather; immutable generated texture'
for l in rows:
 if l['id'] in feature_ids:l['featureFeather']=1
 if l['id']=='fringe-face-edge':l['controlOwner']='fringe-center'
def path(p):return 'M'+' L'.join(','.join(map(str,xy)) for xy in p)+' Z'
textures={f:(r/f).read_bytes() for f in sorted({l['file'] for l in rows})}
defs=f'<filter id="uv-hard" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="discrete" tableValues="0 1"/><feFuncG type="discrete" tableValues="0 1"/><feFuncB type="discrete" tableValues="0 1"/></feComponentTransfer></filter>'+''.join(f'<image id="tex-{f}" width="{struct.unpack(">II",b[16:24])[0]}" height="{struct.unpack(">II",b[16:24])[1]}" href="data:image/png;base64,{base64.b64encode(b).decode()}"/>' for f,b in textures.items())
defs+='<filter id="skin-blend" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter><filter id="feature-blend" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1"/></filter>'
groups=[]
# Deterministic UV ownership at 21 multi-polygon junctions found by full-canvas
# alpha comparison. These retain original texture samples, not painted colors.
corner_owners={'fringe-center':[(508,209)],'hair-gold-clips':[(453,254),(439,268)],'brow-left':[(447,287)],'face':[(483,304),(551,375),(484,397)],'fringe-right':[(554,314),(560,378),(561,379)],'cuff-raised':[(686,337)],'neck-bow-tail-right':[(533,520),(537,530)],'braid-left':[(321,530)],'coat-right-back':[(658,592)],'ribbon-side-right':[(716,612)],'waist-star':[(599,640)],'cuff-lowered':[(223,671),(223,709)],'ribbon-lower-left':[(238,887)],'stocking-straight':[(720,1016)]}
corner_owners.pop('face',None)
corner_owners['braid-right']=[(550,376),(568,386),(557,394)]
for l in rows:
 id=l['id'];defs+=f'<mask id="mask-{id}" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><path d="{path(l["region"])}" fill="white" shape-rendering="crispEdges"/>'+''.join(f'<path d="{path(q)}" fill="black" shape-rendering="crispEdges"/>' for q in l['exclude'])+'</mask>'
 extra=''
 for j,part in enumerate(l.get('residualParts',[])):
  mid=f'residual-{id}-{j}';defs+=f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">'+''.join(f'<path d="{path(q)}" fill="white" shape-rendering="crispEdges"/>' for q in part['regions'])+''.join(f'<path d="{path(q)}" fill="black" shape-rendering="crispEdges"/>' for q in part['exclude'])+'</mask>'
  extra+=f'<use href="#tex-cutout-candidate.png" mask="url(#{mid})"/>'
 if id in corner_owners:
  l['uvCornerCells']=corner_owners[id];cid='corners-'+id;defs+=f'<clipPath id="{cid}">'+''.join(f'<rect x="{x}" y="{y}" width="1" height="1" shape-rendering="crispEdges"/>' for x,y in corner_owners[id])+'</clipPath>';extra+=f'<use href="#tex-cutout-candidate.png" clip-path="url(#{cid})"/>'
 if l.get('inpaintRegions'):
  mid='soft-skin-donor';defs+=f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><g filter="url(#skin-blend)">'+''.join(f'<path d="{path(q)}" fill="white" stroke="white" stroke-width="10" stroke-linejoin="round"/>' for q in l['inpaintRegions'])+'</g></mask>'
  extra+=f'<g mask="url(#mask-{id})"><use href="#tex-face-skin-full-canvas.png" mask="url(#{mid})"/></g>'
 if l.get('featureFeather'):
  mid='soft-feature-'+id;defs+=f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}"><path d="{path(l["region"])}" fill="white" filter="url(#feature-blend)"/></mask>'
  feature_mask=mid
 else:feature_mask='mask-'+id
 transform='matrix('+' '.join(map(str,l.get('sourceTransform',[1,0,0,1,0,0])))+')'
 groups.append(f'<g id="{id}" inkscape:groupmode="layer" inkscape:label="{escape(l["label"])}"'+(' style="display:none"' if l.get('visible') is False else '')+f'><g mask="url(#{feature_mask})"><use href="#tex-{l["file"]}" transform="{transform}"/></g>{extra}</g>')
# Threshold only the ownership masks, never source color/alpha. This avoids
# complementary antialiased mask edges recompositing to 75% alpha at a seam.
import re
defs=re.sub(r'(<mask\b[^>]*>)(.*?)(</mask>)',lambda m:m[0] if 'id="soft-' in m[1] else m[1]+'<g filter="url(#uv-hard)">'+m[2]+'</g>'+m[3],defs)
svg=f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><title>STARUSH Q86 blue-white editable source, UNACCEPTED, not a model</title><defs>{defs}</defs>'+''.join(groups)+'</svg>'
(r/'blue-white-layer-source.svg').write_text(svg)
m=dict(schemaVersion=1,queueItem='Q86',status='work-in-progress',sourcePreparationAccepted=False,artAccepted=False,contentComplete=False,isLive2DModel=False,canvas=dict(width=W,height=H),reference='cutout-candidate.png',sourceNote='User official PNG accessed through image-tool reference; generated derivative bytes. Visible UV partition and hidden inpaint candidates require isolated/shifted inspection. No mesh, rig, physics or runtime acceptance.',layers=rows,sources=[dict(file=f,sha256=hashlib.sha256(b).hexdigest()) for f,b in textures.items()])
(r/'layers.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('SOURCE_GEOMETRY',len(rows))
