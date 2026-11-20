'use strict';
const $=id=>document.getElementById(id),video=$('video'),canvas=$('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true}),status=$('status');
const settings={shadow:45,liner:65,lash:25,lip:60,gloss:30,blush:30,shadowColor:'#ba7199',lipColor:'#a85c75',blushColor:'#d87c8d'};
let mesh,stream=null,image=null,mode=null,landmarks=null,compare=false,frozen=null,busy=false,facing='user',raf=null,session=0;
const FACELIPS=[61,40,37,0,267,270,291,321,314,17,84,91];
const INNER_LIPS=[78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95];
function say(s){status.textContent=s}function coords(i){return {x:landmarks[i].x*canvas.width,y:landmarks[i].y*canvas.height}};
function trace(ids){ctx.beginPath();ids.forEach((id,k)=>{let p=coords(id);k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.closePath()}
function fill(ids,color,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;trace(ids);ctx.fill();ctx.restore()}
function stroke(ids,color,alpha,width){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ids.forEach((id,k)=>{const p=coords(id);k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.stroke();ctx.restore()}
function eyes(){let alpha=settings.shadow/100*.48;fill([33,246,161,160,159,158,157,173,133,124,35],settings.shadowColor,alpha);fill([362,398,384,385,386,387,388,466,263,265,353],settings.shadowColor,alpha);let w=Math.max(1,canvas.width/500*2);stroke([33,160,158,133],'#21151f',settings.liner/100,w);stroke([362,385,387,263],'#21151f',settings.liner/100,w);if(settings.lash){[[33,160,158],[263,387,385]].forEach((ids,side)=>{const a=coords(ids[0]),b=coords(ids[1]),d=side?1:-1;ctx.save();ctx.strokeStyle='#251b21';ctx.globalAlpha=settings.lash/100*.8;ctx.lineWidth=w*.65;for(let j=0;j<3;j++){let x=a.x+(b.x-a.x)*j*.22,y=a.y+(b.y-a.y)*j*.22;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+d*canvas.width*.007,y-canvas.height*.009,x+d*canvas.width*.012,y-canvas.height*(.009+settings.lash/100*.01));ctx.stroke()}ctx.restore()})}}
function lips(){
  ctx.save();ctx.globalAlpha=settings.lip/100*.66;ctx.fillStyle=settings.lipColor;
  ctx.beginPath();
  for(const [ids,reverse] of [[FACELIPS,false],[INNER_LIPS,true]]){
    const points=ids.map(coords);if(reverse)points.reverse();
    points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
  }
  ctx.fill('evenodd');ctx.restore();
  if(settings.gloss){const a=coords(13),b=coords(14);ctx.save();ctx.globalAlpha=settings.gloss/100*.38;ctx.strokeStyle='#fff4f4';ctx.lineWidth=Math.max(1,canvas.width*.004);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x-canvas.width*.025,(a.y+b.y)/2);ctx.lineTo(a.x+canvas.width*.018,(a.y+b.y)/2);ctx.stroke();ctx.restore()}
}
function blush(){[[50,101,118],[280,330,347]].forEach(ids=>{const p=ids.map(coords),x=p.reduce((a,b)=>a+b.x,0)/3,y=p.reduce((a,b)=>a+b.y,0)/3,r=canvas.width*.095;ctx.save();ctx.translate(x,y);ctx.scale(1,.65);let g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,settings.blushColor);g.addColorStop(1,'transparent');ctx.globalAlpha=settings.blush/100*.34;ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.restore()})}
function render(source){if(mode==='captured'&&frozen){if(canvas.width!==frozen.width||canvas.height!==frozen.height){canvas.width=frozen.width;canvas.height=frozen.height}ctx.drawImage(frozen,0,0);return}if(!source)return;let w=source.videoWidth||source.naturalWidth,h=source.videoHeight||source.naturalHeight;if(!w||!h)return;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}ctx.clearRect(0,0,w,h);ctx.save();if(mode==='camera'&&facing==='user'){ctx.translate(w,0);ctx.scale(-1,1)}ctx.drawImage(source,0,0,w,h);ctx.restore();if(landmarks&&!compare){if(mode==='camera'&&facing==='user'){const original=landmarks;landmarks=original.map(p=>({...p,x:1-p.x}));try{blush();eyes();lips()}finally{landmarks=original}}else{blush();eyes();lips()}}}
async function initMesh(){if(mesh)return;if(!window.FaceMesh)throw Error('تعذر تحميل محرك تتبع الوجه. تأكدي من اتصال الإنترنت.');mesh=new FaceMesh({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`});mesh.setOptions({maxNumFaces:1,refineLandmarks:true,minDetectionConfidence:.55,minTrackingConfidence:.5});mesh.onResults(r=>{landmarks=r.multiFaceLandmarks?.[0]||null;if(!frozen&&mode!=='captured')render(mode==='camera'?video:image);if(mode==='image')enabled(!!landmarks);say(landmarks?'تم التعرف على الوجه':'وجّهي الوجه نحو الكاميرا')})}
async function analyze(src){if(!mesh||busy||!src)return;busy=true;try{await mesh.send({image:src})}catch(e){say('تعذر تحليل الوجه: '+e.message)}finally{busy=false}}
async function loop(token){if(mode!=='camera'||frozen||token!==session)return;if(video.readyState>=2)await analyze(video);if(mode==='camera'&&token===session&&!frozen)raf=requestAnimationFrame(()=>loop(token))}
function enabled(on){$('captureBtn').disabled=!on;$('compareBtn').disabled=!on;$('downloadBtn').disabled=!on}
function stopCamera(){session++;if(raf)cancelAnimationFrame(raf);raf=null;stream?.getTracks().forEach(t=>t.stop());stream=null}
async function startCamera(){
  stopCamera();const token=session;frozen=null;image=null;mode='camera';landmarks=null;compare=false;$('compareBtn').textContent='قبل / بعد';
  enabled(false);say('جاري فتح الكاميرا…');
  try{
    await initMesh();if(token!==session)return;
    const incoming=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:960}}});
    if(token!==session){incoming.getTracks().forEach(t=>t.stop());return}
    stream=incoming;video.srcObject=stream;await video.play();
    if(token!==session)return;
    $('empty').hidden=true;enabled(true);loop(token)
  }catch(e){if(token===session){say('تعذر فتح الكاميرا: '+e.message);mode=null;enabled(false)}}
}
$('cameraBtn').onclick=startCamera;$('flipBtn').onclick=()=>{facing=facing==='user'?'environment':'user';startCamera()};
$('upload').onchange=async e=>{
  const f=e.target.files?.[0];if(!f)return;
  stopCamera();const token=session;frozen=null;landmarks=null;mode='image';enabled(false);compare=false;
  $('compareBtn').textContent='قبل / بعد';say('جاري قراءة الصورة وتحليل الوجه…');
  const url=URL.createObjectURL(f),incoming=new Image();
  incoming.onload=async()=>{
    URL.revokeObjectURL(url);if(token!==session||mode!=='image')return;
    image=incoming;$('empty').hidden=true;render(image);
    try{await initMesh();if(token!==session||mode!=='image')return;await analyze(image);if(token!==session||mode!=='image')return;enabled(!!landmarks)}
    catch(err){if(token===session)say(err.message)}
  };
  incoming.onerror=()=>{URL.revokeObjectURL(url);if(token===session)say('تعذر فتح الصورة المختارة')};
  incoming.src=url;e.target.value='';
};
function repaint(){if(mode==='captured')render(null);else render(mode==='camera'?video:image)}
$('compareBtn').onclick=()=>{if(mode==='captured'){say('للمقارنة المباشرة افتحي الكاميرا أو اختاري صورة جديدة');return}compare=!compare;$('compareBtn').textContent=compare?'إظهار المكياج':'قبل / بعد';repaint()};
$('captureBtn').onclick=()=>{if(mode==='camera'){if(!landmarks){say('انتظري حتى يتم التعرف على الوجه');return}render(video);frozen=document.createElement('canvas');frozen.width=canvas.width;frozen.height=canvas.height;frozen.getContext('2d').drawImage(canvas,0,0);stopCamera();mode='captured';$('captureBtn').disabled=true;$('compareBtn').disabled=true;say('تم التصوير، يمكنك حفظ الصورة أو إعادة فتح الكاميرا')}else if(mode==='image'){if(!landmarks){say('لا يمكن التصوير قبل التعرف على الوجه');return}render(image);frozen=document.createElement('canvas');frozen.width=canvas.width;frozen.height=canvas.height;frozen.getContext('2d').drawImage(canvas,0,0);mode='captured';$('captureBtn').disabled=true;$('compareBtn').disabled=true;say('تم تثبيت المكياج على الصورة؛ يمكنك حفظ النتيجة')}else{say('اضغطي فتح الكاميرا لإعادة التصوير')}};
$('downloadBtn').onclick=()=>{if(!canvas.width||!['camera','image','captured'].includes(mode))return;if(mode!=='captured'&&!landmarks){say('انتظري حتى يتم التعرف على الوجه قبل الحفظ');return}render(mode==='camera'?video:image);canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=`mirati-makeup-${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},'image/png')};
for(const key of ['shadow','liner','lash','lip','gloss','blush']){$(key).oninput=e=>{settings[key]=+e.target.value;$(key+'Val').textContent=settings[key]+'%';repaint()}}
for(const key of ['shadowColor','lipColor','blushColor'])$(key).oninput=e=>{settings[key]=e.target.value;repaint()};
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.tab,.panel').forEach(e=>e.classList.remove('active'));btn.classList.add('active');$(btn.dataset.tab).classList.add('active')});
$('resetBtn').onclick=()=>{for(const [key,value] of Object.entries({shadow:45,liner:65,lash:25,lip:60,gloss:30,blush:30,shadowColor:'#ba7199',lipColor:'#a85c75',blushColor:'#d87c8d'})){settings[key]=value;$(key).value=value;if($(key+'Val'))$(key+'Val').textContent=value+'%'}repaint()};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
