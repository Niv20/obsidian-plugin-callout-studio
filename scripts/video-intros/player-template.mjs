/** Only this small, pure React player is included as executable scene code. */
export function sceneSource(meta, states, points) {
	return `import React from "react";
import { SceneImage } from "@scene/sdk";

type SceneProps = {
  frame: number; fps: number; width: number; height: number;
  durationInFrames: number;
  parameters: Record<string, string | number | boolean>;
  asset: (path: string) => string;
};
// Artwork is exported from the actual Callout Studio components and installed
// Obsidian styles. No product controls are redrawn in this player.
const states = ${JSON.stringify(states)};
const points = ${JSON.stringify(points)};
const duration = ${meta.duration};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const x=clamp(n); return x*x*x*(x*(x*6-15)+10); };

export default function Scene({frame, fps, width, height, durationInFrames, parameters, asset}: SceneProps) {
  const seconds = Math.max(0, frame / Math.max(1, fps));
  const hold = Math.max(0, Math.min(duration, durationInFrames / Math.max(1,fps)) - 1);
  const time = Math.min(seconds, hold);
  const cursorScale = typeof parameters.cursorScale === "number" ? Math.max(0.7,Math.min(1.5,parameters.cursorScale)) : 1;
  let index=0;
  for(let i=1;i<states.length;i++) if(time>=states[i].time) index=i;
  const current=states[index];
  const transition=Math.min(current.transition, Math.max(0,hold-current.time));
  const blend=index===0 || transition===0 ? 1 : smooth((time-current.time)/transition);
  let p=points[0];
  for(let i=1;i<points.length;i++) {
    const next=points[i];
    if(time<=next.time) {
      const previous=points[i-1];
      const f=smooth((time-previous.time)/Math.max(0.001,next.time-previous.time));
      p={...previous,x:previous.x+(next.x-previous.x)*f,y:previous.y+(next.y-previous.y)*f};
      break;
    }
    p=next;
  }
  const lastClick=[...points].reverse().find(point=>point.click && point.time<=time);
  const clickAge=lastClick ? time-lastClick.time : 1;
  const clickProgress=clamp(clickAge/0.28);
  const press=clickAge<0.14 ? 1-0.12*Math.sin(clamp(clickAge/0.14)*Math.PI) : 1;
  const zoom=${meta.id === "01" ? "1+0.04*smooth((time-0.8)/0.6)*(1-smooth((time-7.1)/0.6))" : "1"};
  const imageStyle: React.CSSProperties={position:"absolute",inset:0,width:740,height:650,objectFit:"contain",transform:\`scale(\${zoom})\`,transformOrigin:"370px 325px"};
  return <div style={{width,height,position:"relative",background:"transparent",overflow:"hidden",pointerEvents:"none"}}>
    <div style={{position:"absolute",left:0,top:0,width:740,height:650,transformOrigin:"0 0",transform:\`scale(\${width/740},\${height/650})\`}}>
      {index>0 && blend<1 && <SceneImage src={asset(states[index-1].file)} width={740} height={650} style={{...imageStyle,opacity:1-blend}} />}
      <SceneImage src={asset(current.file)} width={740} height={650} style={{...imageStyle,opacity:blend}} />
      <svg width={740} height={650} viewBox="0 0 740 650" style={{position:"absolute",inset:0,overflow:"visible"}} aria-hidden="true">
        {lastClick && clickProgress<1 && <circle cx={lastClick.x} cy={lastClick.y} r={5+12*clickProgress} fill="none" stroke="#9071d8" strokeWidth={1.5} opacity={0.55*(1-clickProgress)}/>}
        <g transform={\`translate(\${p.x},\${p.y}) scale(\${cursorScale*press})\`}>
          <path d="M1 1 L1 24 L7.1 18.3 L12.2 29 L17.2 26.6 L12.2 16.4 L21 16.4 Z" fill="#17191f" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
        </g>
      </svg>
    </div>
  </div>;
}
`;
}
