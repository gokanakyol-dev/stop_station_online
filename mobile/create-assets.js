// Basit PNG asset dosyaları oluştur (sharp ile)
const sharp = require('sharp');
const path = require('path');

async function createAssets() {
  const assetsDir = path.join(__dirname, 'assets');
  
  console.log('Creating PNG assets with sharp...\n');
  
  // Icon (1024x1024, mavi)
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 122, b: 255, alpha: 1 }
    }
  })
  .png()
  .toFile(path.join(assetsDir, 'icon.png'));
  console.log('✓ icon.png created (1024x1024)');
  
  // Splash (1284x2778, beyaz arka plan + mavi logo)
  await sharp({
    create: {
      width: 1284,
      height: 2778,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .composite([{
    input: await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 0, g: 122, b: 255, alpha: 1 }
      }
    }).png().toBuffer(),
    gravity: 'center'
  }])
  .png()
  .toFile(path.join(assetsDir, 'splash.png'));
  console.log('✓ splash.png created (1284x2778)');
  
  // Adaptive Icon (1024x1024, mavi)
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 122, b: 255, alpha: 1 }
    }
  })
  .png()
  .toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png created (1024x1024)');
  
  // Favicon (48x48, mavi)
  await sharp({
    create: {
      width: 48,
      height: 48,
      channels: 4,
      background: { r: 0, g: 122, b: 255, alpha: 1 }
    }
  })
  .png()
  .toFile(path.join(assetsDir, 'favicon.png'));
  console.log('✓ favicon.png created (48x48)');
  
  console.log('\n✅ All assets created successfully!');
}

createAssets().catch(console.error);

