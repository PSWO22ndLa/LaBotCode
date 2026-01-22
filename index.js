// ========== 引入模組 ==========
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const cors = require('cors');

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  REST,
  Routes,
  PermissionsBitField,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const clientSecret = process.env.CLIENT_SECRET;
const callbackURL = process.env.CALLBACK_URL;
const sessionSecret = process.env.SESSION_SECRET;
// ========== Express Web 伺服器 ==========
const app = express();
const PORT = process.env.PORT || 3000;

// 中介軟體
app.use(cors({
  origin: true, // 允許所有來源（開發用）
  credentials: true
}));
app.use(express.json());
app.use(express.static('C:/Users/ao130/Desktop/pjskpracticehouse net')); // 如果你的 HTML 放在 public 資料夾

// Session 設定
app.use(session({
  secret: sessionSecret || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 天
  }
}));

// Passport 設定
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const titlesData = loadTitles();
    const userData = titlesData[id];
    if (userData) {
      // 從 Discord 獲取最新使用者資訊
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        const member = await guild.members.fetch(id).catch(() => null);
        if (member) {
          userData.username = member.user.username;
          userData.avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
          
          // 獲取身分組稱號
          const roles = member.roles.cache;
          const rankRole = roles.find(r => rankRoles.includes(r.name));
          userData.rank = rankRole ? rankRole.name : 'プロセカ初心者';
        }
      }
    }
    done(null, userData || { id, username: 'Unknown', achievements: [], pb: [], totalPoints: 0, rank: 'プロセカ初心者' });
  } catch (error) {
    done(error, null);
  }
});

// Discord OAuth 策略
passport.use(new DiscordStrategy({
    clientID: clientId,
    clientSecret: clientSecret,
    callbackURL: callbackURL,
    scope: ['identify', 'guilds']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const titlesData = loadTitles();
      let userData = titlesData[profile.id];
      
      if (!userData) {
        userData = {
          id: profile.id,
          username: profile.username,
          avatar: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
          specialTitles: [],
          totalPoints: 0,
          achievements: [],
          pb: [],
          equippedTitles: [null, null, null],
          rank: 'プロセカ初心者'
        };
        titlesData[profile.id] = userData;
        saveTitles(titlesData);
      } else {
        userData.username = profile.username;
        userData.avatar = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
      }
      
      return done(null, userData);
    } catch (error) {
      return done(error, null);
    }
  }
));

// ===== API 路由 =====

// 登入路由
app.get('/api/auth/discord', passport.authenticate('discord'));

// 登入回調
app.get('/api/auth/callback', 
  passport.authenticate('discord', { failureRedirect: '/?login=failed' }),
  (req, res) => {
    res.redirect('/?login=success');
  }
);

// 檢查登入狀態
app.get('/api/auth/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ loggedIn: true, user: req.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// 登出
app.get('/api/auth/logout', (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

// 獲取使用者稱號
app.get('/api/user/:userId/titles', (req, res) => {
  try {
    const titlesData = loadTitles();
    const userData = titlesData[req.params.userId];
    if (!userData) {
      return res.json({ 
        specialTitles: [], 
        achievements: [], 
        pb: [],
        rank: 'プロセカ初心者',
        messageCount: 0
      });
    }
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: '讀取失敗' });
  }
});

// 啟動 Web 伺服器
app.listen(PORT, () => {
  console.log(`🌐 Web 伺服器運行於 http://localhost:${PORT}`);
});

// ========== Discord Bot 部分 ==========
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ========== JSON 資料 ==========
const playersPath = path.join(__dirname, 'players.json');
const achievementsPath = path.join(__dirname, 'achievements.json');
const bottlePath = path.join(__dirname, 'bottles.json');
const pbPath = path.join(__dirname, 'pb.json');
const wordlePath = path.join(__dirname, 'wordle.json');
const titlesPath = path.join(__dirname, 'titles.json'); // 稱號資料

// 初始化 JSON 檔案
function initJSON(filePath, defaultData = {}) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

initJSON(playersPath);
initJSON(bottlePath, []);
initJSON(pbPath);
initJSON(wordlePath, []);
initJSON(titlesPath); // 初始化稱號檔案

function loadPlayers() { return JSON.parse(fs.readFileSync(playersPath, 'utf8')); }
function savePlayers(players) { fs.writeFileSync(playersPath, JSON.stringify(players, null, 2), 'utf8'); }
function loadPB() { return JSON.parse(fs.readFileSync(pbPath, 'utf8')); }
function savePB(data) { fs.writeFileSync(pbPath, JSON.stringify(data, null, 2), 'utf8'); }
function loadTitles() { return JSON.parse(fs.readFileSync(titlesPath, 'utf8')); }
function saveTitles(data) { fs.writeFileSync(titlesPath, JSON.stringify(data, null, 2), 'utf8'); }

const achievements = fs.existsSync(achievementsPath) ? JSON.parse(fs.readFileSync(achievementsPath, 'utf8')) : [];

let bottles = [];
try {
  if (fs.existsSync(bottlePath)) {
    bottles = JSON.parse(fs.readFileSync(bottlePath, 'utf8'));
    if (!Array.isArray(bottles)) bottles = [];
  }
} catch {
  bottles = [];
}

let wordleWords = [];
if (fs.existsSync(wordlePath)) {
  wordleWords = JSON.parse(fs.readFileSync(wordlePath, 'utf8'));
}

// ========== Canvas 設定 ==========
let Canvas;
try {
  Canvas = require('canvas');
  const { registerFont } = Canvas;
  const fontPath = path.join(__dirname, 'fonts', 'NotoSansJP-Bold.ttf');
  if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: 'Noto Sans JP' });
  }
} catch (err) {
  console.warn('⚠️ Canvas 或字型載入失敗，PB 圖片生成功能將無法使用');
}

const TEMPLATE_PATH = path.join(__dirname, 'template.png');
const SONG_ART_PATH = path.join(__dirname, 'songs');
if (!fs.existsSync(SONG_ART_PATH)) fs.mkdirSync(SONG_ART_PATH, { recursive: true });

// ========== 常數定義 ==========
const allowedRoles = ["手續委員", "管管"];
const rankRoles = [
  "プロセカ初心者","プロセカ青銅者","プロセカ白銀者","プロセカ黃金者",
  "プロセカ白金者","プロセカ鑽石者","プロセカ大師","プロセカ巔峰者",
  "プロセカ 亞神","プロセカ 神","プロセカ 天啓","プロセカ 創神者","プロセカ ∞"
];

// 身分組 → 稱號對應表
const ROLE_TO_TITLE_MAP = {
  '新手': { id: 'beginner', name: 'プロセカ初心者' },
  '青銅': { id: 'bronze', name: 'プロセカ青銅者' },
  '白銀': { id: 'silver', name: 'プロセカ白銀者' },
  '黃金': { id: 'gold', name: 'プロセカ黃金者' },
  '白金': { id: 'platinum', name: 'プロセカ白金者' },
  '鑽石': { id: 'diamond', name: 'プロセカ鑽石者' },
  '大師': { id: 'master', name: 'プロセカ大師' },
  '巔峰': { id: 'peak', name: 'プロセカ巔峰者' },
  '亞神': { id: 'demigod', name: 'プロセカ 亞神' },
  '神': { id: 'god', name: 'プロセカ 神' },
  '天啓': { id: 'revelation', name: 'プロセカ 天啓' },
  '創神者': { id: 'creator', name: 'プロセカ 創神者' },
  '無限': { id: 'infinity', name: 'プロセカ ∞' },
  '管理員': { id: 'admin_2025', name: '2025 管管' },
  '幹部': { id: 'staff_2025', name: '2025 幹部' },
  '貢獻者': { id: 'contributor', name: '特殊貢獻者' },
};

// ========== Wordle 互動式系統 (使用 Discord 按鈕) ==========
const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
} = require('discord.js');

// 全域變數
let wordleRoom = null;

// 生成隨機單字
function generateWord() {
  const validWords = wordleWords.filter(w => w.length >= 4 && w.length <= 6);
  if (validWords.length === 0) {
    console.error('❌ wordle.json 中沒有有效單字');
    return 'WORD';
  }
  const word = validWords[Math.floor(Math.random() * validWords.length)];
  return word.toLowerCase();
}

// 檢查是否為有效單字
function isValidWord(word) {
  return wordleWords.some(w => w.toLowerCase() === word.toLowerCase());
}

// 計算猜測結果
function getWordleResult(guess, answer) {
  const res = Array(guess.length).fill(null);
  const answerArr = answer.split('');
  const used = Array(answer.length).fill(false);

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answerArr[i]) {
      res[i] = 'G';
      used[i] = true;
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (res[i] === 'G') continue;
    const idx = answerArr.findIndex((ch, j) => ch === guess[i] && !used[j]);
    if (idx !== -1) {
      res[i] = 'Y';
      used[idx] = true;
    } else {
      res[i] = 'B';
    }
  }

  return res;
}

// 更新鍵盤狀態
function updateKeyboard(playerKeyboard, guess, resultArray) {
  const priority = { 'U': 0, 'B': 1, 'Y': 2, 'G': 3 };
  
  for (let i = 0; i < guess.length; i++) {
    const letter = guess[i].toLowerCase();
    const status = resultArray[i];
    
    if (!playerKeyboard[letter] || priority[status] > priority[playerKeyboard[letter]]) {
      playerKeyboard[letter] = status;
    }
  }
}

// 創建視覺化鍵盤 (使用按鈕)
// 創建視覺化鍵盤 (使用按鈕) - Discord 每行最多 5 個按鈕
function createKeyboardRows(playerKeyboard) {
  // 將鍵盤分成多行,每行最多 5 個按鈕
  const rows = [
    ['Q', 'W', 'E', 'R', 'T'],
    ['Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G'],
    ['H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B'],
  ];
  
  const actionRows = rows.map(row => {
    const buttons = row.map(letter => {
      const status = playerKeyboard[letter.toLowerCase()] || 'U';
      let style = ButtonStyle.Secondary;
      
      if (status === 'G') style = ButtonStyle.Success;
      else if (status === 'Y') style = ButtonStyle.Primary;
      else if (status === 'B') style = ButtonStyle.Danger;
      
      return new ButtonBuilder()
        .setCustomId(`key_${letter}_${Date.now()}`)
        .setLabel(letter)
        .setStyle(style)
        .setDisabled(true);
    });
    
    return new ActionRowBuilder().addComponents(buttons);
  });
  
  return actionRows.slice(0, 5); // Discord 最多 5 個 ActionRow
}

// 顯示遊戲面板
function createGameEmbed(userId) {
  if (!wordleRoom || !wordleRoom.players[userId]) return null;
  
  const pdata = wordleRoom.players[userId];
  const maxTries = wordleRoom.word.length + 1;
  const answer = wordleRoom.word;
  
  // 建立猜測顯示
  let guessDisplay = '';
  
  for (let i = 0; i < maxTries; i++) {
    if (i < pdata.guesses.length) {
      const g = pdata.guesses[i];
      const blocks = g.result.map(r => {
        if (r === 'G') return '🟩';
        if (r === 'Y') return '🟨';
        return '⬛';
      }).join('');
      guessDisplay += `${blocks} ${g.guess.toUpperCase()}\n`;
    } else {
      guessDisplay += '⬜'.repeat(answer.length) + '\n';
    }
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`🎮 Wordle - ${wordleRoom.roomName}`)
    .setDescription(
      `🎯 目標長度: **${answer.length}** 字母\n` +
      `🔢 嘗試次數: **${pdata.guesses.length}/${maxTries}**\n\n` +
      guessDisplay
    )
    .setColor(0x00D9E5)
    .setFooter({ text: '輸入字母猜測單字！' });
  
  return embed;
}

// 廣播所有玩家狀態
async function broadcastAllPlayers(channel) {
  if (!wordleRoom) return;
  
  for (const userId of Object.keys(wordleRoom.players)) {
    const embed = createGameEmbed(userId);
    const keyboard = createKeyboardRows(wordleRoom.players[userId].keyboard);
    
    await channel.send({
      content: `<@${userId}> 的遊戲面板:`,
      embeds: [embed],
      components: keyboard
    });
  }
}

// 檢查遊戲是否結束
function checkGameEnd(channel) {
  if (!wordleRoom) return false;
  
  const maxTries = wordleRoom.word.length + 1;
  let allFinished = true;
  let winners = [];
  
  for (const [uid, pdata] of Object.entries(wordleRoom.players)) {
    const hasWon = pdata.guesses.some(g => g.guess === wordleRoom.word);
    const hasFailed = pdata.guesses.length >= maxTries;
    
    if (hasWon) winners.push(uid);
    if (!hasWon && !hasFailed) allFinished = false;
  }
  
  if (allFinished || winners.length === Object.keys(wordleRoom.players).length) {
    const resultEmbed = new EmbedBuilder()
      .setTitle('🏁 Wordle 遊戲結束！')
      .setDescription(`📖 答案是: **${wordleRoom.word.toUpperCase()}**`)
      .setColor(0xFFD700);
    
    if (winners.length > 0) {
      resultEmbed.addFields({
        name: '🎉 獲勝者',
        value: winners.map(uid => `<@${uid}>`).join('\n')
      });
    }
    
    channel.send({ embeds: [resultEmbed] });
    wordleRoom = null;
    return true;
  }
  
  return false;
}

// ========== 指令處理 ==========

// !create - 建立房間
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.startsWith('!create')) {
    const args = content.split(' ');
    const roomName = args[1];
    
    if (!roomName) {
      return message.reply('❌ 請輸入房間名稱\n用法: `!create 房間名`');
    }
    
    if (wordleRoom) {
      return message.reply('❌ 已有房間存在，請先結束後再建立新房間！');
    }
    
    wordleRoom = {
      channelId: message.channel.id,
      roomName,
      hostId: message.author.id,
      word: generateWord(),
      started: false,
      players: {}
    };
    
    wordleRoom.players[message.author.id] = { 
      guesses: [], 
      keyboard: {},
      currentInput: ''
    };
    
    const embed = new EmbedBuilder()
      .setTitle('🎮 Wordle 房間已建立')
      .setDescription(
        `📝 房間名稱: **${roomName}**\n` +
        `👑 房主: <@${message.author.id}>\n` +
        `📌 目標長度: **${wordleRoom.word.length}** 字母\n\n` +
        `✅ 輸入 \`!join\` 加入遊戲\n` +
        `✅ 房主輸入 \`!start\` 開始遊戲`
      )
      .setColor(0x00D9E5);
    
    return message.channel.send({ embeds: [embed] });
  }
  
  // !join - 加入房間
  if (lowerContent.startsWith('!join')) {
    if (!wordleRoom) {
      return message.reply('❌ 目前沒有房間，請先使用 `!create 房間名` 建立');
    }
    
    if (wordleRoom.started) {
      return message.reply('❌ 遊戲已開始，無法加入');
    }
    
    if (wordleRoom.players[message.author.id]) {
      return message.reply('⚠️ 你已經在房間中了');
    }
    
    wordleRoom.players[message.author.id] = { 
      guesses: [], 
      keyboard: {},
      currentInput: ''
    };
    
    return message.reply(
      `✅ <@${message.author.id}> 已加入房間\n` +
      `目前玩家數: **${Object.keys(wordleRoom.players).length}** 人`
    );
  }
  
  // !start - 開始遊戲
  if (lowerContent.startsWith('!start')) {
    if (!wordleRoom) {
      return message.reply('❌ 目前沒有房間');
    }
    
    if (message.author.id !== wordleRoom.hostId) {
      return message.reply('❌ 只有房主可以開始遊戲');
    }
    
    if (wordleRoom.started) {
      return message.reply('❌ 遊戲已經開始了');
    }
    
    wordleRoom.started = true;
    
    const embed = new EmbedBuilder()
      .setTitle('🎉 遊戲開始！')
      .setDescription(
        `🎯 單字長度: **${wordleRoom.word.length}** 字母\n` +
        `🔢 最多嘗試: **${wordleRoom.word.length + 1}** 次\n` +
        `👥 參與玩家: **${Object.keys(wordleRoom.players).length}** 人\n\n` +
        `💬 直接輸入 **${wordleRoom.word.length} 個英文字母** 開始猜測！\n` +
        `鍵盤會即時更新顏色：\n` +
        `🟩 = 正確位置 | 🟨 = 字母存在但位置錯 | ⬛ = 不存在`
      )
      .setColor(0x00FF00);
    
    await message.channel.send({ embeds: [embed] });
    
    // 為每個玩家發送遊戲面板
    setTimeout(() => broadcastAllPlayers(message.channel), 1000);
    return;
  }
  
  // !end - 結束房間
  if (lowerContent.startsWith('!end')) {
    if (!wordleRoom) {
      return message.reply('❌ 目前沒有房間');
    }
    
    if (message.author.id !== wordleRoom.hostId) {
      return message.reply('❌ 只有房主可以結束房間');
    }
    
    const answer = wordleRoom.word.toUpperCase();
    wordleRoom = null;
    
    return message.reply(`🏁 房間已結束\n答案是: **${answer}**`);
  }
  
  // 猜測單字
  if (wordleRoom && 
      wordleRoom.started && 
      message.channel.id === wordleRoom.channelId &&
      wordleRoom.players[message.author.id]) {
    
    if (!/^[a-zA-Z]+$/.test(lowerContent)) return;
    
    const playerData = wordleRoom.players[message.author.id];
    const answer = wordleRoom.word.toLowerCase();
    const guess = lowerContent;
    
    if (guess.length !== answer.length) {
      return message.reply({
        content: `❌ 請輸入 **${answer.length}** 個字母 (你輸入了 ${guess.length} 個)`,
        ephemeral: true
      }).catch(() => {});
    }
    
    if (!isValidWord(guess)) {
      return message.reply({
        content: '❌ 這不是一個有效的英文單字',
        ephemeral: true
      }).catch(() => {});
    }
    
    const maxTries = answer.length + 1;
    
    if (playerData.guesses.length >= maxTries) {
      return message.reply({
        content: `❌ 你已用完所有 ${maxTries} 次機會`,
        ephemeral: true
      }).catch(() => {});
    }
    
    if (playerData.guesses.some(g => g.guess === guess)) {
      return message.reply({
        content: '⚠️ 你已經猜過這個單字了',
        ephemeral: true
      }).catch(() => {});
    }
    
    // 計算結果
    const resultArray = getWordleResult(guess, answer);
    playerData.guesses.push({ guess, result: resultArray });
    updateKeyboard(playerData.keyboard, guess, resultArray);
    
    // 更新面板
    const embed = createGameEmbed(message.author.id);
    const keyboard = createKeyboardRows(playerData.keyboard);
    
    await message.channel.send({
      content: `<@${message.author.id}> 猜測: **${guess.toUpperCase()}**`,
      embeds: [embed],
      components: keyboard
    });
    
    // 檢查是否猜中
    if (guess === answer) {
      const attempts = playerData.guesses.length;
      await message.channel.send(
        `🎉 恭喜 <@${message.author.id}> 猜中答案！\n` +
        `答案是: **${answer.toUpperCase()}**\n` +
        `使用了 **${attempts}** 次嘗試`
      );
      
      setTimeout(() => checkGameEnd(message.channel), 2000);
    } 
    else if (playerData.guesses.length >= maxTries) {
      await message.channel.send(
        `😢 <@${message.author.id}> 已用完所有機會\n` +
        `繼續等待其他玩家...`
      );
      
      setTimeout(() => checkGameEnd(message.channel), 2000);
    }
  }
});

// ========== Canvas 圖片生成 ==========
async function loadSongImage(songName) {
  if (!Canvas) return null;
  
  const songPath = path.join(SONG_ART_PATH, `${songName}.png`);
  try {
    const buffer = fs.readFileSync(songPath);
    return await Canvas.loadImage(buffer);
  } catch {
    const defaultPath = path.join(SONG_ART_PATH, "default.png");
    try {
      const buffer = fs.readFileSync(defaultPath);
      return await Canvas.loadImage(buffer);
    } catch {
      return null;
    }
  }
}

async function generatePBImage(song, difficulty, recordData, interaction) {
  if (!Canvas) throw new Error('Canvas 未安裝');
  
  const base = await Canvas.loadImage(TEMPLATE_PATH);
  const songArt = await loadSongImage(song);
  const canvas = Canvas.createCanvas(base.width, base.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(base, 0, 0);

  if (songArt) ctx.drawImage(songArt, 150, 190, 700, 700);

  // 曲名
  let fontSize = 70;
  ctx.font = `bold ${fontSize}px "Noto Sans JP"`;
  let maxWidth = 1920 - 150 - 700 - 80;
  while (ctx.measureText(song).width > maxWidth && fontSize > 28) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px "Noto Sans JP"`;
  }
  ctx.fillStyle = "#ffffffff";
  ctx.fillText(song, 900, 230);

  // 難度
  let diffText = difficulty.toUpperCase();
  ctx.font = `bold 32px "Noto Sans JP"`;
  let diffColor = "#FFFFFF";

  if (difficulty.toLowerCase().includes("append")) {
    let g = ctx.createLinearGradient(900, 0, 1200, 0);
    g.addColorStop(0, "#ffb6e9ff");
    g.addColorStop(1, "#da60ffff");
    diffColor = g;
  } else if (difficulty.toLowerCase().includes("master")) diffColor = "#B388FF";
  else if (difficulty.toLowerCase().includes("expert")) diffColor = "#FF8A80";
  else if (difficulty.toLowerCase().includes("hard")) diffColor = "#E5FF00";
  else if (difficulty.toLowerCase().includes("normal")) diffColor = "#00BFFF";
  else if (difficulty.toLowerCase().includes("easy")) diffColor = "#2BFF00";

  ctx.fillStyle = diffColor;
  ctx.fillText(diffText, 900, 295);

  // FC / AP
  ctx.shadowColor = "rgba(255,255,255,0.7)";
  ctx.shadowBlur = 35;
  ctx.font = `bold 80px "Noto Sans JP"`;

  const isAP = recordData.g === 0 && recordData.good === 0 && recordData.bad === 0 && recordData.miss === 0;
  const isFC = !isAP && recordData.good === 0 && recordData.bad === 0 && recordData.miss === 0;

  if (isAP || isFC) {
    const text = isAP ? "ALL PERFECT" : "FULL COMBO";
    const textX = 900;
    const textY = 390;
    const textWidth = ctx.measureText(text).width;
    const gradient = ctx.createLinearGradient(textX, 0, textX + textWidth, 0);

    if (isAP) {
      gradient.addColorStop(0, "#FFF59D");
      gradient.addColorStop(0.33, "#FCC1C1");
      gradient.addColorStop(0.66, "#F9D4FF");
      gradient.addColorStop(1, "#70FFF8");
    } else {
      gradient.addColorStop(0, "#FFD7B9");
      gradient.addColorStop(0.33, "#FFDFFA");
      gradient.addColorStop(0.66, "#FDE6F3");
      gradient.addColorStop(1, "#D0EEFF");
    }

    ctx.fillStyle = gradient;
    ctx.fillText(text, textX, textY);
  }

  ctx.shadowBlur = 0;

  // 成績
  const scoreX = 900;
  let scoreY = 480;
  const scoreGap = 85;
  ctx.font = `bold 50px "Noto Sans JP"`;

  function drawScore(label, value, y) {
    let num = value.toString().padStart(4, "0");
    let firstNonZero = num.search(/[1-9]/);
    if (firstNonZero === -1) firstNonZero = 3;

    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < firstNonZero ? "#999" : "#ffffffff";
      ctx.fillText(num[i], scoreX + 350 + i * 30, y);
    }

    const x = scoreX;
    if (label === "PERFECT") {
      const textWidth = ctx.measureText(label).width;
      const textHeight = 50;
      const angle = 80 * Math.PI / 180;
      const gradient = ctx.createLinearGradient(
        x, y - textHeight,
        x + Math.cos(angle) * textWidth,
        y + Math.sin(angle) * textHeight
      );
      gradient.addColorStop(0.0, "#46ffa9ff");
      gradient.addColorStop(0.33, "#b3c1ffff");
      gradient.addColorStop(0.66, "#ff4fb8");
      gradient.addColorStop(1.0, "#feffb5ff");
      ctx.fillStyle = gradient;
    } else if (label === "GREAT") ctx.fillStyle = "#ff6cebff";
    else if (label === "GOOD") ctx.fillStyle = "#48cef0ff";
    else if (label === "BAD") ctx.fillStyle = "#4dee47ff";
    else if (label === "MISS") ctx.fillStyle = "#999999";
    else ctx.fillStyle = "#ffffffff";

    ctx.fillText(label, scoreX, y);
  }

  drawScore("PERFECT", recordData.p, scoreY);
  drawScore("GREAT", recordData.g, scoreY + scoreGap);
  drawScore("GOOD", recordData.good, scoreY + scoreGap * 2);
  drawScore("BAD", recordData.bad, scoreY + scoreGap * 3);
  drawScore("MISS", recordData.miss, scoreY + scoreGap * 4);

  // 玩家資訊
  const user = interaction.user;
  const username = user.username;
  const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
  const timestamp = new Date().toLocaleString('zh-TW', { hour12: false });

  const avatar = await Canvas.loadImage(avatarURL);
  ctx.drawImage(avatar, 20, 20, 80, 80);

  ctx.font = `24px "Noto Sans JP"`;
  ctx.fillStyle = "#ffffffff";
  ctx.textAlign = "left";
  ctx.fillText(username, 110, 55);

  ctx.font = `24px "Noto Sans JP"`;
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.fillText(timestamp, 110, 90);

  return canvas.toBuffer();
}

// ========== 訊息事件處理 ==========
// ========== 訊息事件處理 (合併版) ==========
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message || !message.content) return;

  // ===== 💬 記錄發言次數 =====
  if (message.guild && message.guild.id === guildId) {
    try {
      const titlesData = loadTitles();
      const userId = message.author.id;
      
      if (!titlesData[userId]) {
        titlesData[userId] = {
          id: userId,
          specialTitles: [],
          totalPoints: 0,
          achievements: [],
          pb: [],
          equippedTitles: [null, null, null],
          messageCount: 0
        };
      }
      
      titlesData[userId].messageCount = (titlesData[userId].messageCount || 0) + 1;
      saveTitles(titlesData);
      
      console.log(`📊 ${message.author.username} 發言次數: ${titlesData[userId].messageCount}`);
    } catch (error) {
      console.error('記錄發言失敗:', error);
    }
  }

  const content = message.content.trim();
  const lowerContent = content.toLowerCase();

  // ===== 自動回覆 =====
  if (content === '嗨') return message.channel.send('哈囉呦~~');
  if (content === '我菜') return message.channel.send('對,你菜,你菜逼八0w0');
  if (content === '菜') return message.channel.send('你才菜,你就是菜逼八0w0');

  // ===== 升職系統 =====
  if (content.includes("恭喜")) {
    const member = await message.guild.members.fetch(message.author.id);
    const hasPermission = member.roles.cache.some(role => allowedRoles.includes(role.name));
    if (!hasPermission) return message.reply("❌ 你沒有權限使用這個功能。");

    if (content.includes("全員升級") || content.includes("全員降級")) {
      const upgrade = content.includes("全員升級");
      const allMembers = await message.guild.members.fetch();

      for (const [id, m] of allMembers) {
        if (m.user.bot) continue;
        const currentRoles = m.roles.cache.filter(r => rankRoles.includes(r.name));
        if (currentRoles.size === 0) continue;

        let highestIndex = -1;
        currentRoles.forEach(r => {
          const idx = rankRoles.indexOf(r.name);
          if (idx > highestIndex) highestIndex = idx;
        });

        let newIndex = upgrade ? highestIndex + 1 : highestIndex - 1;
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= rankRoles.length) newIndex = rankRoles.length - 1;

        const newRole = message.guild.roles.cache.find(r => r.name === rankRoles[newIndex]);
        if (!newRole) continue;

        await m.roles.remove(currentRoles);
        await m.roles.add(newRole);
      }

      return message.reply(`✅ 已對全員進行${upgrade ? "升級" : "降級"}!`);
    }

    if (message.mentions.users.size > 0) {
      const user = message.mentions.users.first();
      const target = await message.guild.members.fetch(user.id);
      const match = content.match(/升為\s+(.+)/);
      if (!match) return;
      const newRoleName = match[1].trim();
      const newRole = message.guild.roles.cache.find(r => r.name === newRoleName);
      if (!newRole) return message.reply(`❌ 找不到名為「${newRoleName}」的身分組。`);

      const rolesToRemove = target.roles.cache.filter(r => rankRoles.includes(r.name));
      if (rolesToRemove.size > 0) await target.roles.remove(rolesToRemove);
      await target.roles.add(newRole);

      return message.reply(`✅ 已將 ${user.username} 升為 ${newRoleName}!`);
    }
  }

  // ===== 漂流瓶系統 =====
  if (message.reference && content === '丟漂流瓶') {
    const repliedMsg = await message.fetchReference().catch(() => null);
    if (!repliedMsg) return message.reply('⚠️ 找不到你要丟的內容喔!');

    const imageUrl = repliedMsg.attachments.size > 0 ? repliedMsg.attachments.first().url : null;
    const askContent = await message.channel.send('請輸入你想寫在漂流瓶裡的內容:');
    const contentReply = await message.channel.awaitMessages({
      filter: m => m.author.id === message.author.id,
      max: 1,
      time: 60000
    }).catch(() => null);
    
    if (!contentReply || contentReply.size === 0) {
      return message.channel.send('⏰ 超時啦,下次再試吧!');
    }

    const bottleContent = contentReply.first().content;
    const askAnon = await message.channel.send('是否要匿名?(回覆 是 / 否)');
    const anonReply = await message.channel.awaitMessages({
      filter: m => m.author.id === message.author.id,
      max: 1,
      time: 30000
    }).catch(() => null);
    
    const anonymous = anonReply && anonReply.first().content === '是';
    const authorDisplay = anonymous ? '匿名使用者' : `<@${message.author.id}>`;

    const bottleData = {
      id: bottles.length + 1,
      author: message.author.id,
      anonymous,
      authorDisplay,
      date: new Date().toLocaleDateString('zh-TW'),
      content: bottleContent,
      imageUrl
    };
    
    bottles.push(bottleData);
    fs.writeFileSync(bottlePath, JSON.stringify(bottles, null, 2), 'utf8');

    const embed = new EmbedBuilder()
      .setTitle(`🫧 已成功丟出漂流瓶!`)
      .setDescription(`你的漂流瓶已漂浮於大海之中 🌊\n編號:No.${String(bottleData.id).padStart(5,'0')}`)
      .setColor(0x00ADEF)
      .setTimestamp();
    
    if (imageUrl) embed.setImage(imageUrl);
    return message.channel.send({ embeds: [embed] });
  }

  if (content === '撿漂流瓶') {
    if (bottles.length === 0) {
      return message.channel.send('🌊 海面上目前沒有漂流瓶喔!');
    }
    
    const randomBottle = bottles[Math.floor(Math.random() * bottles.length)];
    const bottleNo = `No.${String(randomBottle.id).padStart(5,'0')}`;
    const embed = new EmbedBuilder()
      .setTitle(`🫧 漂流瓶【${bottleNo}】`)
      .setDescription(
        `來自 ${randomBottle.authorDisplay}\n時間:${randomBottle.date}\n\n內容:${randomBottle.content}`
      )
      .setColor(0x00C6FF)
      .setTimestamp();
    
    if (randomBottle.imageUrl) embed.setImage(randomBottle.imageUrl);
    return message.channel.send({ embeds: [embed] });
  }
});

// ========== Slash 指令註冊 ==========
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName('myachievements').setDescription('查詢我的成就'),
    new SlashCommandBuilder().setName('achievements').setDescription('查看所有成就清單'),
    new SlashCommandBuilder()
      .setName('grant')
      .setDescription('給予玩家成就（管理員用）')
      .addUserOption(opt => opt.setName('user').setDescription('目標使用者').setRequired(true))
      .addStringOption(opt => opt.setName('achievement').setDescription('成就ID').setRequired(true)),
    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('禁言一名用戶')
      .addUserOption(opt => opt.setName('user').setDescription('要禁言的用戶').setRequired(true))
      .addIntegerOption(opt => opt.setName('time').setDescription('禁言時間（分鐘）').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('禁言原因').setRequired(false)),
    new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('提前解除用戶禁言')
      .addUserOption(opt => opt.setName('user').setDescription('要解除禁言的用戶').setRequired(true)),
    new SlashCommandBuilder()
      .setName('pbset')
      .setDescription('設定成員 PB 資料')
      .addUserOption(opt => opt.setName('user').setDescription('要設定的使用者').setRequired(true))
      .addStringOption(opt => opt.setName('song').setDescription('歌曲 ID').setRequired(true))
      .addStringOption(opt => opt.setName('difficulty').setDescription('難度').setRequired(true))
      .addIntegerOption(opt => opt.setName('p').setDescription('Perfect 數量').setRequired(true))
      .addIntegerOption(opt => opt.setName('g').setDescription('Great 數量').setRequired(true))
      .addIntegerOption(opt => opt.setName('good').setDescription('Good 數量').setRequired(true))
      .addIntegerOption(opt => opt.setName('bad').setDescription('Bad 數量').setRequired(true))
      .addIntegerOption(opt => opt.setName('miss').setDescription('Miss 數量').setRequired(true)),
    new SlashCommandBuilder()
      .setName('pb')
      .setDescription('查詢玩家 PB')
      .addUserOption(o => o.setName('user').setDescription('目標玩家').setRequired(true))
      .addStringOption(o => o.setName('song').setDescription('歌曲名稱').setRequired(true))
      .addStringOption(o => o.setName('difficulty').setDescription('難度').setRequired(true)),
    
    // 稱號指令
    new SlashCommandBuilder()
      .setName('授予稱號')
      .setDescription('給整個身分組的成員授予稱號')
      .addRoleOption(option =>
        option.setName('身分組')
          .setDescription('要授予稱號的身分組')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('稱號')
          .setDescription('要授予的稱號')
          .setRequired(true)
          .addChoices(
            { name: 'プロセカ初心者', value: 'beginner' },
            { name: 'プロセカ青銅者', value: 'bronze' },
            { name: 'プロセカ白銀者', value: 'silver' },
            { name: 'プロセカ黃金者', value: 'gold' },
            { name: 'プロセカ白金者', value: 'platinum' },
            { name: 'プロセカ鑽石者', value: 'diamond' },
            { name: 'プロセカ大師', value: 'master' },
            { name: 'プロセカ巔峰者', value: 'peak' },
            { name: 'プロセカ 亞神', value: 'demigod' },
            { name: 'プロセカ 神', value: 'god' },
            { name: 'プロセカ 天啓', value: 'revelation' },
            { name: 'プロセカ 創神者', value: 'creator' },
            { name: 'プロセカ ∞', value: 'infinity' },
            { name: '2025 管管', value: 'admin_2025' },
            { name: '2025 幹部', value: 'staff_2025' },
            { name: '特殊貢獻者', value: 'contributor' }
          )
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName('同步身分組稱號')
      .setDescription('自動根據身分組授予對應稱號')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName('查看稱號')
      .setDescription('查看成員已解鎖的稱號')
      .addUserOption(option =>
        option.setName('成員')
          .setDescription('要查看的成員 (不填則查看自己)')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('移除稱號')
      .setDescription('移除成員的特定稱號')
      .addUserOption(option =>
        option.setName('成員')
          .setDescription('要移除稱號的成員')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('稱號id')
          .setDescription('要移除的稱號 ID')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('📌 註冊指令中...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('✅ 指令註冊完成（包含稱號系統）');
  } catch (err) {
    console.error('❌ 指令註冊失敗:', err);
  }
}

// ========== Slash 指令處理 ==========
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // 稱號系統指令優先處理
  try {
    if (commandName === '授予稱號') {
      return await handleGrantTitle(interaction);
    } else if (commandName === '同步身分組稱號') {
      return await handleSyncRoleTitles(interaction);
    } else if (commandName === '查看稱號') {
      return await handleViewTitles(interaction);
    } else if (commandName === '移除稱號') {
      return await handleRevokeTitle(interaction);
    }
  } catch (error) {
    console.error('稱號指令執行錯誤:', error);
    if (!interaction.replied && !interaction.deferred) {
      return await interaction.reply({ content: '❌ 執行指令時發生錯誤', ephemeral: true });
    }
  }

  // 其他系統指令
  const players = loadPlayers();
  const userId = interaction.user.id;

  // 成就系統
  if (commandName === 'myachievements') {
    const player = players[userId] || { achievements: [], points: 0 };
    let reply = `🎖️ **你的成就** 🎖️\n總點數：${player.points}\n\n`;
    if (player.achievements.length === 0) {
      reply += "（尚未獲得任何成就）";
    } else {
      player.achievements.forEach(aid => {
        const ach = achievements.find(a => a.id === aid);
        if (ach) reply += `🏆 ${ach.name} - ${ach.description} (+${ach.points}pt)\n`;
      });
    }
    return interaction.reply({ content: reply, ephemeral: true });
  }

  if (commandName === 'achievements') {
    let reply = "🏅 **目前所有成就清單** 🏅\n\n";
    achievements.forEach(a => reply += `🏆 **${a.name}** — ${a.description} (+${a.points}pt)\n`);
    return interaction.reply({ content: reply, ephemeral: true });
  }

  if (commandName === 'grant') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ 你沒有權限執行這個指令', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const achId = interaction.options.getString('achievement');
    const ach = achievements.find(a => a.id === achId);
    
    if (!ach) return interaction.reply({ content: '❌ 找不到這個成就ID', ephemeral: true });
    if (!players[user.id]) players[user.id] = { achievements: [], points: 0 };
    
    if (!players[user.id].achievements.includes(achId)) {
      players[user.id].achievements.push(achId);
      players[user.id].points += ach.points;
      savePlayers(players);
      return interaction.reply(`✅ 已給予 ${user.username} 成就 **${ach.name}** (+${ach.points}pt)`);
    } else {
      return interaction.reply(`⚠️ ${user.username} 已經有這個成就了`);
    }
  }

  // 禁言系統
  const allowedMuteRoles = ['管管', '秩序委員'];
  if (['mute', 'unmute'].includes(commandName)) {
    if (!interaction.member.roles.cache.some(r => allowedMuteRoles.includes(r.name))) {
      return interaction.reply({ content: '❌ 你沒有使用此指令的權限。', ephemeral: true });
    }
  }

  if (commandName === 'mute') {
    const target = interaction.options.getUser('user');
    const time = interaction.options.getInteger('time');
    const reason = interaction.options.getString('reason') || '未提供原因';
    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    
    if (!targetMember) {
      return interaction.reply({ content: '⚠️ 找不到該用戶。', ephemeral: true });
    }
    
    try {
      await targetMember.timeout(time * 60 * 1000, `${reason}（由 ${interaction.user.tag} 禁言）`);
      return interaction.reply(`🔇 已禁言 ${target} ${time} 分鐘。理由：${reason}`);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: '❌ 禁言失敗，可能我權限不足。', ephemeral: true });
    }
  }

  if (commandName === 'unmute') {
    const target = interaction.options.getUser('user');
    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    
    if (!targetMember) {
      return interaction.reply({ content: '⚠️ 找不到該用戶。', ephemeral: true });
    }
    
    try {
      await targetMember.timeout(null, `由 ${interaction.user.tag} 提前解除禁言`);
      return interaction.reply(`✅ 已解除 ${target} 的禁言。`);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: '❌ 無法解除禁言，可能我權限不足。', ephemeral: true });
    }
  }

  // PB 系統
  const pb = loadPB();

  if (commandName === 'pbset') {
    const member = interaction.member;
    const allow = member.roles.cache.some(r => ["功能委員", "管管"].includes(r.name));
    if (!allow) {
      return interaction.reply({ content: "❌ 你沒有權限審核 PB", ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const song = interaction.options.getString('song');
    const difficulty = interaction.options.getString('difficulty');
    const p = interaction.options.getInteger('p');
    const g = interaction.options.getInteger('g');
    const good = interaction.options.getInteger('good');
    const bad = interaction.options.getInteger('bad');
    const miss = interaction.options.getInteger('miss');

    if (!pb[user.id]) pb[user.id] = {};
    if (!pb[user.id][song]) pb[user.id][song] = {};

    pb[user.id][song][difficulty] = { p, g, good, bad, miss };
    savePB(pb);

    return interaction.reply(`✅ 已更新 ${user.username} 的 PB：${song} ${difficulty}`);
  }

  if (commandName === 'pb') {
    const user = interaction.options.getUser('user');
    const song = interaction.options.getString('song');
    const difficulty = interaction.options.getString('difficulty');

    if (!pb[user.id] || !pb[user.id][song] || !pb[user.id][song][difficulty]) {
      return interaction.reply("❌ 查無 PB 資料");
    }

    const data = pb[user.id][song][difficulty];

    await interaction.deferReply();

    try {
      const img = await generatePBImage(song, difficulty, data, interaction);
      await interaction.editReply({
        content: `🎵 ${user.username} 的 PB`,
        files: [{ attachment: img, name: `${user.id}_${song}.png` }]
      });
    } catch (err) {
      console.error('生成 PB 圖片失敗:', err);
      await interaction.editReply("❌ 生成 PB 圖片失敗");
    }
  }
});

// ========== 稱號系統處理函數 ==========

// 1. 授予稱號給整個身分組
async function handleGrantTitle(interaction) {
  await interaction.deferReply();

  const role = interaction.options.getRole('身分組');
  const titleId = interaction.options.getString('稱號');
  
  const titleInfo = Object.values(ROLE_TO_TITLE_MAP).find(t => t.id === titleId);
  if (!titleInfo) {
    return await interaction.editReply('❌ 找不到該稱號');
  }

  const members = await interaction.guild.members.fetch();
  const roleMembers = members.filter(member => member.roles.cache.has(role.id));

  if (roleMembers.size === 0) {
    return await interaction.editReply(`❌ 沒有成員擁有 ${role.name} 身分組`);
  }

  let successCount = 0;
  let failCount = 0;

  for (const [userId, member] of roleMembers) {
    try {
      await grantTitleToUser(userId, titleInfo);
      successCount++;
    } catch (error) {
      console.error(`授予稱號給 ${member.user.tag} 失敗:`, error);
      failCount++;
    }
  }

  await interaction.editReply(
    `✅ 已授予 **${titleInfo.name}** 給 ${role.name} 身分組\n` +
    `成功: ${successCount} 人\n` +
    `失敗: ${failCount} 人`
  );
}

// 2. 自動同步身分組稱號
async function handleSyncRoleTitles(interaction) {
  await interaction.deferReply();

  const members = await interaction.guild.members.fetch();
  let syncCount = 0;

  for (const [userId, member] of members) {
    const userRoles = member.roles.cache;
    const titlesToGrant = [];
    
    for (const [roleName, titleInfo] of Object.entries(ROLE_TO_TITLE_MAP)) {
      const hasRole = userRoles.find(role => role.name === roleName);
      if (hasRole) {
        titlesToGrant.push(titleInfo);
      }
    }

    if (titlesToGrant.length > 0) {
      try {
        for (const title of titlesToGrant) {
          await grantTitleToUser(userId, title);
        }
        syncCount++;
      } catch (error) {
        console.error(`同步 ${member.user.tag} 稱號失敗:`, error);
      }
    }
  }

  await interaction.editReply(`✅ 已同步 ${syncCount} 位成員的稱號`);
}

// 3. 查看成員稱號
async function handleViewTitles(interaction) {
  const targetUser = interaction.options.getUser('成員') || interaction.user;
  const userId = targetUser.id;

  try {
    const titlesData = loadTitles();
    const userData = titlesData[userId];
    
    if (!userData || !userData.specialTitles || userData.specialTitles.length === 0) {
      return await interaction.reply({
        content: `${targetUser.tag} 目前沒有解鎖任何特殊稱號`,
        ephemeral: true
      });
    }

    const titlesList = userData.specialTitles
      .map(titleId => {
        const title = Object.values(ROLE_TO_TITLE_MAP).find(t => t.id === titleId);
        return title ? `• ${title.name}` : `• ${titleId}`;
      })
      .join('\n');

    await interaction.reply({
      content: `**${targetUser.tag} 的稱號:**\n${titlesList}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('查看稱號錯誤:', error);
    await interaction.reply({
      content: '❌ 查詢失敗',
      ephemeral: true
    });
  }
}

// 4. 移除稱號
async function handleRevokeTitle(interaction) {
  const targetUser = interaction.options.getUser('成員');
  const titleId = interaction.options.getString('稱號id');
  const userId = targetUser.id;

  try {
    const titlesData = loadTitles();
    const userData = titlesData[userId];
    
    if (!userData) {
      return await interaction.reply({
        content: '❌ 找不到該使用者資料',
        ephemeral: true
      });
    }

    if (userData.specialTitles) {
      userData.specialTitles = userData.specialTitles.filter(id => id !== titleId);
    }

    titlesData[userId] = userData;
    saveTitles(titlesData);

    await interaction.reply({
      content: `✅ 已移除 ${targetUser.tag} 的稱號`,
      ephemeral: true
    });
  } catch (error) {
    console.error('移除稱號錯誤:', error);
    await interaction.reply({
      content: '❌ 移除失敗',
      ephemeral: true
    });
  }
}

// 工具函數: 授予稱號給使用者
async function grantTitleToUser(userId, titleInfo) {
  const titlesData = loadTitles();
  let userData = titlesData[userId];
  
  if (!userData) {
    userData = {
      id: userId,
      specialTitles: [],
      totalPoints: 0,
      achievements: [],
      pb: [],
      equippedTitles: [null, null, null]
    };
  }

  if (!userData.specialTitles) {
    userData.specialTitles = [];
  }

  if (userData.specialTitles.includes(titleInfo.id)) {
    return;
  }

  userData.specialTitles.push(titleInfo.id);
  titlesData[userId] = userData;
  saveTitles(titlesData);
}

// ========== Bot 啟動 ==========
client.once('ready', () => {
  console.log(`✅ 已登入 ${client.user.tag}`);
  registerCommands();
});

client.login(process.env.DISCORD_TOKEN || token);