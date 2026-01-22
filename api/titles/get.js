const fs = require('fs');
const path = require('path');

export default function handler(req, res) {
  try {
    // 讀取 titles.json
    const titlesPath = path.join(process.cwd(), 'titles.json');
    const titlesData = fs.readFileSync(titlesPath, 'utf8');
    const titles = JSON.parse(titlesData);
    
    // 如果有提供 userId，返回該用戶的稱號
    const { userId } = req.query;
    
    if (userId) {
      const userTitles = titles[userId] || [];
      return res.status(200).json({ 
        success: true,
        titles: userTitles 
      });
    }
    
    // 否則返回所有稱號
    res.status(200).json({ 
      success: true,
      titles 
    });
    
  } catch (error) {
    console.error('Error reading titles:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to read titles' 
    });
  }
}