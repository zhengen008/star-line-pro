import OSS from 'ali-oss';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const DIR_MAP = {
  contract: 'contract',
  tender: 'tender',
  proposal: 'proposal',
  reimbursement: 'reimbursement',
  purchase: 'purchase',
  invoice: 'invoice',
  seal: 'seal',
  project: 'project',
  other: 'other',
};

// multer/busboy 对非 ASCII 文件名按 latin1 解码，这里还原为 UTF-8（前端 FormData 发送的是 UTF-8 字节）
function decodeOriginalName(name) {
  if (!name) return name;
  try {
    const buf = Buffer.from(name, 'latin1');
    const utf8 = buf.toString('utf8');
    // 若还原后含替换符则说明本来就是 ASCII/无乱码，原样返回
    return utf8.includes('\uFFFD') ? name : utf8;
  } catch {
    return name;
  }
}

function getClient() {
  const region = process.env.OSS_REGION;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  const bucket = process.env.OSS_BUCKET;

  if (!region || !accessKeyId || !accessKeySecret || !bucket) return null;

  return new OSS({ region, accessKeyId, accessKeySecret, bucket });
}

// OSS object key 文件名：字母+数字随机生成（保留原扩展名），
// 避免中文/特殊字符文件名在 OSS 上的编码问题；原始文件名由前端展示并存入业务数据。
const RANDOM_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function randomObjectName(originalName) {
  const extMatch = /(\.[a-zA-Z0-9]+)$/.exec(originalName || '');
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  const bytes = randomBytes(16);
  let name = '';
  for (let i = 0; i < 16; i++) {
    name += RANDOM_CHARS[bytes[i] % RANDOM_CHARS.length];
  }
  return `${name}${ext}`;
}

export async function ossUpload(req, res) {
  try {
    const file = req.file;
    const fileType = req.body?.fileType || 'other';

    if (!file) {
      return res.status(400).json({ error: '未提供文件' });
    }

    const client = getClient();
    if (!client) {
      return res.status(500).json({ error: 'OSS not configured' });
    }

    const dir = DIR_MAP[fileType] || 'other';
    const originalName = decodeOriginalName(file.originalname);
    const objectKey = `${dir}/${randomObjectName(originalName)}`;

    await client.put(objectKey, file.buffer, {
      headers: { 'Content-Type': file.mimetype || 'application/octet-stream' },
      mime: file.mimetype,
    });

    // Return proxy URL (works regardless of OSS bucket ACL)
    const proxyUrl = `/api/files/${objectKey}`;
    const directUrl = `http://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/${objectKey}`;

    res.json({
      url: proxyUrl,
      file_url: proxyUrl,
      key: objectKey,
      name: originalName,
      size: file.size,
    });
  } catch (error) {
    console.error('OSS upload error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Proxy endpoint to serve OSS files through backend.
// 鉴权：支持 Authorization: Bearer <JWT>，或查询参数 ?token=<JWT>
// （<a>/<img>/<iframe> 无法携带 header，前端统一用 fileUrl() 拼 token）。
// 支持 HTTP Range（206 部分内容），保证浏览器 PDF 预览/大文件分段加载流畅。
export async function ossProxy(req, res) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
      ? header.slice(7)
      : (typeof req.query.token === 'string' ? req.query.token : '');

    if (!token) {
      return res.status(401).json({ error: '未登录，无法访问文件' });
    }
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: '登录已失效，请重新登录' });
    }

    const client = getClient();
    if (!client) {
      return res.status(500).json({ error: 'OSS not configured' });
    }

    const key = req.params[0]; // wildcard path
    const range = req.headers.range;

    const result = range
      ? await client.get(key, { headers: { Range: range } })
      : await client.get(key);

    const status = range && result.res.status ? result.res.status : 200;
    res.status(status);
    res.set({
      'Content-Type': result.res.headers['content-type'] || 'application/octet-stream',
      'Content-Length': result.res.headers['content-length'] || result.content.length,
      'Accept-Ranges': 'bytes',
      // 私有文件：禁止 public 缓存；inline 以便 iframe 内嵌预览 PDF
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline',
    });
    if (range && result.res.headers['content-range']) {
      res.set('Content-Range', result.res.headers['content-range']);
    }
    res.end(result.content);
  } catch (error) {
    console.error('OSS proxy error:', error);
    res.status(404).json({ error: '文件不存在或无法访问' });
  }
}
