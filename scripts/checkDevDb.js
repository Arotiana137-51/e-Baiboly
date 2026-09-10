// scripts/checkDevDb.js
/**
 * Check that both dev and prod database structures exist
 * With separate directories, no rebuild needed when switching modes
 */

const fs = require('fs');
const { getDatabasePaths, getAssetsPaths } = require('./utils/paths');

const checkDevDb = () => {
  const databasePaths = getDatabasePaths();

  console.log('🔍 Checking database structure (dev + prod)...\n');

  let hasErrors = false;

  // Check dev structure (.db files)
  const devFiles = [
    { path: databasePaths.bible.dev, name: 'BibleMG65.db (dev)' },
    { path: databasePaths.hymns.dev, name: 'Hymns.db (dev)' },
  ];

  console.log('📂 Development files (.db):');
  for (const file of devFiles) {
    if (!fs.existsSync(file.path)) {
      console.error(`   ❌ MISSING: ${file.name}`);
      hasErrors = true;
    } else {
      const stats = fs.statSync(file.path);
      console.log(`   ✅ ${file.name} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    }
  }

  // Check prod structure (.zip files)
  const prodFiles = [
    { path: databasePaths.bible.prod, name: 'BibleMG65.zip (prod)' },
    { path: databasePaths.hymns.prod, name: 'Hymns.zip (prod)' },
  ];

  console.log('\n📦 Production files (.zip):');
  for (const file of prodFiles) {
    if (!fs.existsSync(file.path)) {
      console.error(`   ❌ MISSING: ${file.name}`);
      hasErrors = true;
    } else {
      const stats = fs.statSync(file.path);
      console.log(`   ✅ ${file.name} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    }
  }

  console.log('');

  if (hasErrors) {
    console.error('❌ Database structure incomplete');
    console.error('\nTo build both dev and prod databases:');
    console.error('  yarn build:database\n');
    process.exit(1);
  }

  console.log('✅ Both dev and prod database structures ready!');
  console.log('   The app will automatically use:');
  console.log('   - data/dev/ for development (__DEV__ = true)');
  console.log('   - data/prod/ for production (__DEV__ = false)\n');
  process.exit(0);
};

checkDevDb();
