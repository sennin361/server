const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = path.join(__dirname, 'users.json');
const POSTS_FILE = path.join(__dirname, 'posts.json');

// 初期化
let users = fs.existsSync(USERS_FILE)
  ? JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'))
  : {};
let posts = fs.existsSync(POSTS_FILE)
  ? JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'))
  : [];

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 投稿取得
app.get('/api/posts', (req, res) => {
  res.json(posts.slice().reverse());
});

// 投稿追加（認証後）
app.post('/api/posts', (req, res) => {
  const { username, password, message } = req.body;
  if (!username || !password || !message) {
    return res.status(400).json({ error: '未入力の項目があります' });
  }
  if (!users[username] || users[username] !== password) {
    return res.status(401).json({ error: 'ユーザー名またはパスワードが違います' });
  }

  const newPost = { name: username, message, timestamp: new Date() };
  posts.push(newPost);
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));

  res.json({ success: true });
});

// 新規ユーザー登録
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' });
  }
  if (users[username]) {
    return res.status(409).json({ error: '既に存在するユーザー名です' });
  }

  users[username] = password;
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🌐 仙人掲示板 running at http://localhost:${PORT}`);
});
