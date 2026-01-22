const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');

const commands = [
    {
        name: 'pbset',
        description: '設定玩家 PB 成績（審核員用）',
        options: [
            {
                name: 'user',
                description: '玩家',
                type: 6, // USER
                required: true
            },
            {
                name: 'song',
                description: '歌曲名稱（要與 images/songs 中檔名一致）',
                type: 3, // STRING
                required: true
            },
            {
                name: 'difficulty',
                description: '難度（例如：Master, Append, Expert）',
                type: 3,
                required: true
            },
            {
                name: 'record',
                description: '成績格式：P-G-Good-Bad-Miss',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: 'pb',
        description: '查看玩家的 PB 成績（圖片）',
        options: [
            {
                name: 'user',
                description: '玩家',
                type: 6,
                required: true
            },
            {
                name: 'song',
                description: '歌曲名稱',
                type: 3,
                required: true
            },
            {
                name: 'difficulty',
                description: '難度',
                type: 3,
                required: true
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('⏳ 正在註冊 Slash 指令...');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );
        console.log('✅ 指令註冊成功！');
    } catch (error) {
        console.error(error);
    }
})();
