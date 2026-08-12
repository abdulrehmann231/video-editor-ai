import { join } from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill, ensureBrowser } from '@remotion/renderer';
import { parseEdl } from '../src/lib/edl/schema.ts';
import { motionFromEdl } from '../src/lib/motion/ir/index.ts';
import { buildMotionProps } from '../src/lib/motion/render/props.ts';
const BASE='public/testclips/demo.mp4'; const MEDIA={width:1280,height:720,fps:30};
const OUT='/tmp/edl'; fs.mkdirSync(OUT,{recursive:true});
const CASES=[
 {name:'edl_annotate',frame:30,ops:[{id:'a',type:'annotate',start:0,end:2.5,reason:'point',annotation:'arrow',x:0.42,y:0.12,w:0.16,h:0.16,fromX:0.15,fromY:0.2,color:'#ffffff'}]},
 {name:'edl_nametag',frame:45,ops:[{id:'n',type:'name_tag',start:0,end:2.5,reason:'label',text:'THE FOUNDER',targetX:0.5,targetY:0.18,side:'below'}]},
 {name:'edl_checklist',frame:60,ops:[{id:'c',type:'checklist',start:0,end:2.5,reason:'list',title:'FOCUS ON',items:[{text:'EXPERTISE',mark:'check'},{text:'BUSY WORK',mark:'cross'},{text:'SYSTEMS',mark:'check'}]}]},
 {name:'edl_comparison',frame:60,ops:[{id:'m',type:'comparison',start:0,end:2.5,reason:'vs',leftTitle:'EMPLOYEE',leftItems:['Trade hours','Capped pay'],leftTone:'bad',rightTitle:'OWNER',rightItems:['Build assets','Uncapped'],rightTone:'good'}]},
];
await ensureBrowser();
const serveUrl=await bundle({entryPoint:join(process.cwd(),'src/remotion/index.ts')});
for(const c of CASES){
  const {edl}=parseEdl({ops:c.ops},{durationSec:6});
  const {compositions,warnings}=motionFromEdl(edl,[],6,MEDIA);
  if(warnings.length)console.log('warn',c.name,warnings);
  const inputProps=buildMotionProps({cutUrl:BASE,editMedia:MEDIA,layout:'landscape',compositions,outputDurationSec:2.5});
  const composition=await selectComposition({serveUrl,id:'Motion',inputProps,timeoutInMilliseconds:120000});
  await renderStill({composition,serveUrl,output:join(OUT,c.name+'.png'),frame:c.frame,inputProps,timeoutInMilliseconds:120000});
  console.log('OK',c.name,'comps',compositions.length);
}
