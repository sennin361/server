const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL接続プール
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Renderの場合は必要なことが多いです
});

// テーブル作成（初回起動時のみ）
async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
createTables().catch(e => console.error('テーブル作成エラー', e));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: 'sennin-secret-key',
  resave: false,
  saveUninitialized: false,
}));

app.use(express.static('public'));

function checkAuth(req, res, next) {
  if(req.session && req.session.userId) next();
  else res.status(401).json({ error: "Unauthorized" });
}

// 新規登録
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if(!username || !password) return res.status(400).json({ error: "必須項目が不足" });

    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if(userCheck.rows.length > 0) return res.status(400).json({ error: "ユーザー名が存在します" });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, hash]
    );

    // 登録後ログイン状態にするためユーザーID取得
    const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    req.session.userId = userRes.rows[0].id;
    req.session.username = username;

    res.json({ message: "登録成功", username });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: "登録時エラー" });
  }
});

// ログイン
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if(!username || !password) return res.status(400).json({ error: "必須項目が不足" });

    const userRes = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if(userRes.rows.length === 0) return res.status(400).json({ error: "ユーザーが見つかりません" });

    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if(!match) return res.status(400).json({ error: "パスワード違います" });

    req.session.userId = user.id;
    req.session.username = username;

    res.json({ message: "ログイン成功", username });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: "ログイン時エラー" });
  }
});

// ログアウト
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: "ログアウトしました" });
});

// 投稿取得（最新50件）
app.get('/api/posts', async (req, res) => {
  try {
    const postsRes = await pool.query('SELECT * FROM posts ORDER BY created_at DESC LIMIT 50');
    res.json(postsRes.rows);
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: "投稿取得エラー" });
  }
});

// 投稿（認証必須）
app.post('/api/posts', checkAuth, async (req, res) => {
  try {
    const content = req.body.content;
    if(!content || content.trim() === "") {
      return res.status(400).json({ error: "投稿内容空です" });
    }
    await pool.query(
      'INSERT INTO posts (username, content) VALUES ($1, $2)',
      [req.session.username, content]
    );
    res.json({ message: "投稿成功" });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: "投稿エラー" });
  }
});

// ユーザー情報取得
app.get('/api/me', (req, res) => {
  if(req.session && req.session.userId) {
    res.json({ username: req.session.username });
  } else {
    res.status(401).json({ error: "未ログイン" });
  }
});

app.listen(PORT, () => {
  console.log(`仙人掲示板 PostgreSQL版 ポート${PORT}で起動`);
});
