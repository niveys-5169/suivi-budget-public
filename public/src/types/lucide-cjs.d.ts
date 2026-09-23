// Build CJS de lucide, importé dynamiquement par <CategoryIcon/> pour les noms
// hors table statique : module distinct du barrel ESM, donc chunk à part.
declare module 'lucide-react/dist/cjs/lucide-react.js' {
  export * from 'lucide-react';
}
