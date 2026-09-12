import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const srcDir = path.join(__dirname, '..', 'public', 'src');
const appJsPath = path.join(srcDir, 'app.js');
const styleCssPath = path.join(srcDir, 'style.css');
const mainJsPath = path.join(srcDir, 'main.js');

if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
}

let html = fs.readFileSync(indexPath, 'utf-8');

// --- 1. EXTRACTION DU CSS ---
const styleRegex = /<style>([\s\S]*?)<\/style>/;
const styleMatch = html.match(styleRegex);
if (styleMatch) {
    fs.writeFileSync(styleCssPath, styleMatch[1].trim(), 'utf-8');
    html = html.replace(styleRegex, '');
    console.log('✅ CSS extrait vers public/src/style.css');
}

// --- 2. EXTRACTION DU JAVASCRIPT ---
// On cible le script géant grâce à sa bordure en commentaires (════)
const scriptStartRegex = /<script>\s*\/\/ ════════([\s\S]*?)<\/script>\s*<\/body>/;
const scriptMatch = html.match(scriptStartRegex);

if (scriptMatch) {
    const jsContent = '// ════════' + scriptMatch[1];

    // Rendre les fonctions accessibles globalement (window) pour que les appels HTML 
    // existants (onclick, onchange...) continuent de fonctionner en modules ES6.
    const functionRegex = /^(?:async )?function ([a-zA-Z0-9_]+)\s*\(/gm;
    const bindings = [];
    let funcMatch;
    while ((funcMatch = functionRegex.exec(jsContent)) !== null) {
        bindings.push(`window.${funcMatch[1]} = ${funcMatch[1]};`);
    }

    const finalJs = `// --- CODE EXTRAIT AUTOMATIQUEMENT --- \n\n${jsContent}\n\n// --- BINDINGS GLOBAUX ---\n// Expose les fonctions au HTML (car les modules isolent le scope)\n${bindings.join('\n')}\n`;
    fs.writeFileSync(appJsPath, finalJs, 'utf-8');
    console.log('✅ JavaScript extrait vers public/src/app.js');

    // 3. Création du point d'entrée Vite
    const mainJsContent = `import './style.css';\nimport './app.js';\n\nconsole.log('🚀 App front-end initialisée par Vite !');\n`;
    fs.writeFileSync(mainJsPath, mainJsContent, 'utf-8');

    // 4. Modification de index.html
    html = html.replace(scriptStartRegex, '<script type="module" src="/src/main.js"></script>\n</body>');
    fs.writeFileSync(indexPath, html, 'utf-8');
    console.log('✅ index.html allégé avec succès !');
} else {
    console.log('❌ Bloc <script> géant introuvable. Vérifiez le fichier index.html.');
}