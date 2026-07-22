const fs = require('fs');

const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <!-- Fundo Escuro do App (Dark Mode) -->
  <rect width="1024" height="1024" fill="#0a0a0c" />
  
  <!-- Quadrado Laranja com Opacidade e Borda -->
  <rect x="128" y="128" width="768" height="768" rx="192" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-opacity="0.2" stroke-width="16" />
  
  <!-- A Letra H no Laranja Âmbar Principal -->
  <text x="512" y="720" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="550" fill="#f59e0b" text-anchor="middle">H</text>
</svg>`;

fs.writeFileSync('assets/images/logo.svg', svg);
console.log('✅ Base SVG Criada: logo.svg');

try {
  const sharp = require('sharp');
  Promise.all([
    sharp('assets/images/logo.svg').resize(1024, 1024).png().toFile('assets/images/icon.png'),
    sharp('assets/images/logo.svg').resize(1280, 1280).png().toFile('assets/images/splash-icon.png'),
    sharp('assets/images/logo.svg').resize(1024, 1024).png().toFile('assets/images/android-icon-foreground.png'),
    sharp('assets/images/logo.svg').resize(1024, 1024).png().toFile('assets/images/android-icon-background.png'),
    sharp('assets/images/logo.svg').resize(256, 256).png().toFile('assets/images/favicon.png')
  ]).then(() => {
    console.log('✅ Todos os Ícones PNG foram renderizados e substituídos com sucesso!');
  }).catch(e => {
    console.log('❌ Erro renderizando PNGs:', e.message);
  });
} catch (e) {
  console.log('❌ O pacote sharp não foi encontrado:', e.message);
}
