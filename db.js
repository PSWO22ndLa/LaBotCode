const { Pool } = require('pg');

// 從環境變數讀取資料庫連線字串
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 初始化資料表
async function initDatabase() {
  const client = await pool.connect();
  try {
    // 建立 users 資料表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255),
        special_titles TEXT[],
        total_points INTEGER DEFAULT 0,
        achievements TEXT[],
        pb JSONB DEFAULT '[]',
        equipped_titles TEXT[],
        rank VARCHAR(255) DEFAULT 'プロセカ初心者',
        message_count INTEGER DEFAULT 0,
        avatar TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ 資料庫初始化完成');
  } catch (error) {
    console.error('❌ 資料庫初始化失敗:', error);
  } finally {
    client.release();
  }
}

// 取得使用者資料
async function getUser(userId) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!result.rows[0]) return null;
  
  const user = result.rows[0];
  // 轉換資料庫格式回程式使用的格式
  return {
    id: user.id,
    username: user.username,
    specialTitles: user.special_titles || [],
    totalPoints: user.total_points || 0,
    achievements: user.achievements || [],
    pb: user.pb || [],
    equippedTitles: user.equipped_titles || [null, null, null],
    rank: user.rank || 'プロセカ初心者',
    messageCount: user.message_count || 0,
    avatar: user.avatar
  };
}

// 儲存/更新使用者資料
async function saveUser(userId, userData) {
  const username = userData.username || 'Unknown';
  const special_titles = userData.specialTitles || [];
  const total_points = userData.totalPoints || 0;
  const achievements = userData.achievements || [];
  const pb = userData.pb || [];
  const equipped_titles = userData.equippedTitles || [null, null, null];
  const rank = userData.rank || 'プロセカ初心者';
  const message_count = userData.messageCount || 0;
  const avatar = userData.avatar || null;
  
  await pool.query(`
    INSERT INTO users (id, username, special_titles, total_points, achievements, pb, equipped_titles, rank, message_count, avatar, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
    ON CONFLICT (id) 
    DO UPDATE SET 
      username = EXCLUDED.username,
      special_titles = EXCLUDED.special_titles,
      total_points = EXCLUDED.total_points,
      achievements = EXCLUDED.achievements,
      pb = EXCLUDED.pb,
      equipped_titles = EXCLUDED.equipped_titles,
      rank = EXCLUDED.rank,
      message_count = EXCLUDED.message_count,
      avatar = EXCLUDED.avatar,
      updated_at = CURRENT_TIMESTAMP
  `, [userId, username, special_titles, total_points, achievements, JSON.stringify(pb), equipped_titles, rank, message_count, avatar]);
}

// 取得所有使用者
async function getAllUsers() {
  const result = await pool.query('SELECT * FROM users');
  return result.rows.map(user => ({
    id: user.id,
    username: user.username,
    specialTitles: user.special_titles || [],
    totalPoints: user.total_points || 0,
    achievements: user.achievements || [],
    pb: user.pb || [],
    equippedTitles: user.equipped_titles || [null, null, null],
    rank: user.rank || 'プロセカ初心者',
    messageCount: user.message_count || 0,
    avatar: user.avatar
  }));
}

// 增加發言次數
async function incrementMessageCount(userId) {
  await pool.query(`
    INSERT INTO users (id, message_count, updated_at)
    VALUES ($1, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (id)
    DO UPDATE SET 
      message_count = users.message_count + 1,
      updated_at = CURRENT_TIMESTAMP
  `, [userId]);
}

module.exports = {
  pool,
  initDatabase,
  getUser,
  saveUser,
  getAllUsers,
  incrementMessageCount
};