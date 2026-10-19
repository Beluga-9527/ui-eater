import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const project = fileURLToPath(new URL('../',import.meta.url));
const output = resolve(project,'dist-extension');
await build({configFile:false,root:project,publicDir:false,base:'./',plugins:[react()],define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:output,emptyOutDir:true,cssCodeSplit:false,lib:{entry:resolve(project,'extension/content.tsx'),name:'UIEaterContent',formats:['iife'],fileName:()=> 'content.js'},rollupOptions:{output:{inlineDynamicImports:true,assetFileNames:'[name][extname]'}}}});
await build({configFile:false,root:resolve(project,'extension'),publicDir:false,base:'./',build:{outDir:output,emptyOutDir:false,rollupOptions:{input:resolve(project,'extension/popup.html'),output:{entryFileNames:'popup.js',assetFileNames:'[name][extname]'}}}});
await copyFile(resolve(project,'extension/manifest.json'),resolve(output,'manifest.json'));
await copyFile(resolve(project,'extension/README.md'),resolve(output,'README.md'));
await rm(resolve(output,'ui-eater.css'),{force:true});
await mkdir(resolve(output,'icons'),{recursive:true});
const palette = {'.':[0,0,0,0], '#':[36,38,59,255], g:[197,237,84,255], h:[223,255,135,255], w:[255,254,241,255], p:[247,148,173,255]};
const pixels = ['....##....##....','....#g#..#g#....','...##g####g##...','..##hhhhhhhh##..','.##gggggggggg##.','.#gg###gg###gg#.','##g#www##www#g##','#gg#ww###ww##gg#','#gg#ww###ww##gg#','##gg###gg###gg##','.#gggggggggggg#.','.##g########g##.','..#gg#wpww#gg#..','..##gg#pp#gg##..','...###g##g###...','....###..###....'];
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(name,data){const tag=Buffer.from(name),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([size,tag,data,crc]);}
for(const size of [16,32,48,128]){
  const raw=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const color=palette[pixels[Math.floor(y*16/size)][Math.floor(x*16/size)]];for(let c=0;c<4;c++)raw[y*(size*4+1)+1+x*4+c]=color[c];}
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  await writeFile(resolve(output,`icons/${size}.png`),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
const manifest=JSON.parse(await readFile(resolve(output,'manifest.json'),'utf8'));
for(const path of [manifest.action.default_popup,'content.js',...Object.values(manifest.icons)])await readFile(resolve(output,path));
console.log(`Chrome extension ready: ${output}`);
