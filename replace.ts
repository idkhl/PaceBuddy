import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace(/#FDFBF7/g, '#edd3c4');
content = content.replace(/#FC4C02/g, '#4E6EE2');
content = content.replace(/#e04300/g, '#8576DB');
content = content.replace(/#0f172a/g, '#080708');
content = content.replace(/slate-900/g, '[#080708]');
content = content.replace(/slate-800/g, '[#080708]/90');
content = content.replace(/slate-700/g, '[#080708]/80');
content = content.replace(/slate-600/g, '[#080708]/70');
content = content.replace(/slate-500/g, '[#080708]/60');
content = content.replace(/slate-400/g, '[#080708]/50');
content = content.replace(/slate-300/g, '[#080708]/30');
content = content.replace(/slate-200/g, '[#080708]/20');
content = content.replace(/slate-100/g, '[#080708]/10');
content = content.replace(/#fff4f0/g, '#B793AC/40');
content = content.replace(/bg-green-400/g, 'bg-[#B793AC]');
content = content.replace(/text-green-400/g, 'text-[#B793AC]');
content = content.replace(/text-cyan-400/g, 'text-[#edd3c4]');
content = content.replace(/bg-yellow-100\/50/g, 'bg-[#B793AC]/30');
content = content.replace(/prose-slate/g, 'prose-stone prose-p:text-[#080708]/80 prose-li:text-[#080708]/80');
content = content.replace(/text-rose-500/g, 'text-[#8576DB]');
fs.writeFileSync('src/App.tsx', content);

let cssContent = fs.readFileSync('src/index.css', 'utf-8');
cssContent = cssContent.replace(/#FAFAFA/g, '#edd3c4');
fs.writeFileSync('src/index.css', cssContent);
