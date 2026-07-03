import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Gemini APIの初期化
const aiKey = process.env.GEMINI_API_KEY;
let ai = null;
if (aiKey && aiKey !== 'your_gemini_api_key_here') {
  ai = new GoogleGenAI({ apiKey: aiKey });
}

// 1. スプレッドシートのデータを取得するAPI (GAS経由)
app.get('/api/tasks', async (req, res) => {
  const gasUrl = process.env.GAS_API_URL;
  if (!gasUrl) {
    return res.status(400).json({ error: 'GAS_API_URLが設定されていません。.envファイルを確認してください。' });
  }

  try {
    const response = await fetch(gasUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('データ取得エラー:', error);
    res.status(500).json({ error: 'スプレッドシートからのデータ取得に失敗しました。' });
  }
});

// 2. スプレッドシートのデータを更新するAPI (AI解析付き)
app.post('/api/tasks', async (req, res) => {
  const { message } = req.body;
  const gasUrl = process.env.GAS_API_URL;

  if (!message) {
    return res.status(400).json({ error: 'メッセージが空です。' });
  }
  if (!gasUrl) {
    return res.status(400).json({ error: 'GAS_API_URLが設定されていません。' });
  }

  try {
    let updateParams = {};

    // AI（Gemini）によるメッセージ解析
    if (ai) {
      const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `
以下のチャットメッセージから、進捗更新に関する情報を抽出してください。

メッセージ: "${message}"

以下のJSONフォーマットでのみ回答してください。余計な説明文は一切含めないでください。
{
  "companyName": "抽出した会社名（例: 株式会社サンプル）",
  "status": "「対応ステータス」に設定する値（「商談設定」「問い合わせ」「成約」など、メッセージから推測されるステータス）",
  "nextAction": "「次回アクション(対応メモ）」に設定する値（例: 初回商談実施、〇〇書類作成など）",
  "assignee": "「面談担当者」または「書類作成担当者」の名前（見つからなければ空欄）",
  "notes": "「備考」に追記するメモ（見つからなければ空欄）"
}
`;
      const result = await model.generateContent(prompt);
      const aiResponseText = result.response.text().trim();
      
      // JSONのみをパースする（```json...```ブロックを取り除く処理）
      const cleanJson = aiResponseText.replace(/```json|```/g, '').trim();
      updateParams = JSON.parse(cleanJson);
      console.log('AI解析結果:', updateParams);
    } else {
      return res.status(500).json({ error: 'Gemini APIキーが設定されていないため、AI解析ができません。' });
    }

    if (!updateParams.companyName) {
      return res.json({ status: 'ignored', reason: 'メッセージから会社名を特定できませんでした。' });
    }

    // GAS API経由でスプレッドシートを更新
    const updateResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateParams)
    });
    
    const resultData = await updateResponse.json();
    res.json({ status: 'success', aiAnalysis: updateParams, result: resultData });

  } catch (error) {
    console.error('更新エラー:', error);
    res.status(500).json({ error: 'データの更新に失敗しました。' });
  }
});

// 3. チャットツール（LINE / Chatwork / Google Chat）用Webhookの受け口（仮実装）
app.post('/api/webhook/line', (req, res) => {
  // 後ほど実機連携時に処理を組み込みます
  res.sendStatus(200);
});

app.post('/api/webhook/chatwork', (req, res) => {
  res.sendStatus(200);
});

app.post('/api/webhook/googlechat', (req, res) => {
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
