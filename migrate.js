require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrate() {
  console.log('🚀 開始遷移資料...');
  
  try {
    // 初始化資料庫
    await db.initDatabase();
    
    // 讀取 titles.json
    const titlesPath = path.join(__dirname, 'titles.json');
    
    if (!fs.existsSync(titlesPath)) {
      console.log('⚠️ titles.json 不存在，跳過遷移');
      return;
    }
    
    const titlesData = JSON.parse(fs.readFileSync(titlesPath, 'utf8'));
    const userIds = Object.keys(titlesData);
    
    console.log(`📊 找到 ${userIds.length} 位使用者資料`);
    
    let successCount = 0;
    let failCount = 0;
    
    // 逐一遷移每個使用者
    for (const userId of userIds) {
      try {
        const userData = titlesData[userId];
        await db.saveUser(userId, {
          username: userData.username || 'Unknown',
          special_titles: userData.specialTitles || [],
          total_points: userData.totalPoints || 0,
          achievements: userData.achievements || [],
          pb: userData.pb || [],
          equipped_titles: userData.equippedTitles || [null, null, null],
          rank: userData.rank || 'プロセカ初心者',
          message_count: userData.messageCount || 0,
          avatar: userData.avatar || null
        });
        successCount++;
        console.log(`✅ ${userId} 遷移成功`);
      } catch (error) {
        failCount++;
        console.error(`❌ ${userId} 遷移失敗:`, error.message);
      }
    }
    
    console.log('\n📈 遷移完成！');
    console.log(`✅ 成功: ${successCount} 位`);
    console.log(`❌ 失敗: ${failCount} 位`);
    
    // 備份原始檔案
    const backupPath = path.join(__dirname, 'titles.json.backup');
    fs.copyFileSync(titlesPath, backupPath);
    console.log(`💾 已備份原始資料到 ${backupPath}`);
    
  } catch (error) {
    console.error('❌ 遷移過程發生錯誤:', error);
  } finally {
    process.exit(0);
  }
}

migrate();