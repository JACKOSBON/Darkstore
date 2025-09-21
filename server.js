// server.js (Node 18+)
const express = require('express');
const bodyParser = require('body-parser');
const { Octokit } = require('@octokit/rest');

if(!process.env.GITHUB_TOKEN){
  console.error('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');
  process.exit(1);
}

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

// Config: change OWNER/REPO/BRANCH to your repo
const OWNER = process.env.REPO_OWNER || 'JACKOSBON';
const REPO = process.env.REPO_NAME || 'Darkatore';
const BRANCH = process.env.REPO_BRANCH || 'main';

// helper: get file sha if exists
async function getFileSha(path){
  try{
    const res = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
    return res.data.sha;
  }catch(e){ return null; }
}

// API: save file content (string)
app.post('/api/save-file', async (req, res) => {
  // body: { path: 'users.json', content: '...full JSON string...', message: 'update users' }
  const { path, content, message } = req.body;
  if(!path || typeof content !== 'string') return res.json({ ok:false, error:'bad request' });
  try{
    const sha = await getFileSha(path);
    const put = await octokit.repos.createOrUpdateFileContents({
      owner: OWNER, repo: REPO, path,
      message: message || `update ${path}`,
      content: Buffer.from(content, 'utf8').toString('base64'),
      sha: sha || undefined,
      branch: BRANCH
    });
    return res.json({ ok:true, commit: put.data.commit });
  }catch(e){
    console.error(e);
    return res.json({ ok:false, error: e.message });
  }
});

// helper endpoints for common operations:

// add message
app.post('/api/add-message', async (req, res) => {
  // { productId, from, to, text }
  const { productId, from, to, text } = req.body;
  if(!productId || !from || !text) return res.json({ ok:false, error:'missing' });
  try{
    // fetch messages.json
    const get = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path:'messages.json', ref: BRANCH });
    const sha = get.data.sha;
    const content = Buffer.from(get.data.content, 'base64').toString('utf8');
    const obj = JSON.parse(content || '{}');
    obj[productId] = obj[productId] || [];
    obj[productId].push({ id:'m_'+Date.now(), from, to: to||null, text, time: Date.now(), read:false });
    const newContent = JSON.stringify(obj, null, 2);
    const put = await octokit.repos.createOrUpdateFileContents({
      owner: OWNER, repo: REPO, path:'messages.json', message: `add message for ${productId}`, content: Buffer.from(newContent,'utf8').toString('base64'), sha, branch: BRANCH
    });
    return res.json({ ok:true });
  }catch(e){
    console.error(e);
    return res.json({ ok:false, error: e.message });
  }
});

// generic update-users
app.post('/api/update-users', async (req, res) => {
  // body: { users: [ ... ] }
  const { users } = req.body;
  if(!Array.isArray(users)) return res.json({ ok:false, error:'invalid' });
  try{
    const path='users.json';
    const get = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
    const sha = get.data.sha;
    const newContent = JSON.stringify(users, null, 2);
    await octokit.repos.createOrUpdateFileContents({ owner: OWNER, repo: REPO, path, message:'update users', content: Buffer.from(newContent,'utf8').toString('base64'), sha, branch: BRANCH });
    return res.json({ ok:true });
  }catch(e){
    console.error(e);
    return res.json({ ok:false, error: e.message });
  }
});

// save products
app.post('/api/save-products', async (req, res) => {
  const { products } = req.body;
  if(!Array.isArray(products)) return res.json({ ok:false, error:'invalid' });
  try{
    const path='products.json';
    const get = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
    const sha = get.data.sha;
    const newContent = JSON.stringify(products, null, 2);
    await octokit.repos.createOrUpdateFileContents({ owner: OWNER, repo: REPO, path, message:'update products', content: Buffer.from(newContent,'utf8').toString('base64'), sha, branch: BRANCH });
    return res.json({ ok:true });
  }catch(e){
    console.error(e);
    return res.json({ ok:false, error: e.message });
  }
});

// get messages
app.get('/api/get-messages', async (req,res)=>{
  const { productId } = req.query;
  try{
    const get = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path:'messages.json', ref: BRANCH });
    const content = Buffer.from(get.data.content, 'base64').toString('utf8');
    const obj = JSON.parse(content || '{}');
    return res.json({ ok:true, messages: obj[productId]||[] });
  }catch(e){ return res.json({ ok:false, error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server running on', PORT));