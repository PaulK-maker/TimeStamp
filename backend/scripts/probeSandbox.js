require('dotenv').config();
const axios = require('axios');
const fs = require('fs'), path = require('path');
const CLIENT_ID = 'j0BomohNFzn0Ytr7gO83w7t3eQMaXA6D9yuaa5KfG7I';
const CLIENT_SECRET = 'i4x2gp15nqWNnc-rsrj4Qfdv4kVUsuM8v1iyT_ou94U';
const COMPANY = process.env.GUSTO_PARTNER_COMPANY_UUID;
const BANK_UUID = '3c305b5c-5800-4eec-bcc7-06b144ac0a05';

async function run() {
  const tok = await axios.post('https://api.gusto-demo.com/oauth/token',
    new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,grant_type:'refresh_token',refresh_token:process.env.GUSTO_PARTNER_COMPANY_REFRESH}).toString(),
    {headers:{'Content-Type':'application/x-www-form-urlencoded'}});
  const token = tok.data.access_token;
  const envPath = path.resolve(__dirname, '../.env');
  fs.writeFileSync(envPath, fs.readFileSync(envPath,'utf8').replace(/^GUSTO_PARTNER_COMPANY_REFRESH=.*/m, 'GUSTO_PARTNER_COMPANY_REFRESH='+tok.data.refresh_token), 'utf8');
  const h = {Authorization:'Bearer '+token, Accept:'application/json', 'Content-Type':'application/json', 'X-Gusto-API-Version':'2026-02-01'};

  const paths = [
    ['post', '/v1/sandbox/bank_accounts/'+BANK_UUID+'/send_test_deposits'],
    ['post', '/v1/sandbox/bank_accounts/'+BANK_UUID+'/simulate_deposits'],
    ['post', '/v1/sandbox/bank_accounts/'+BANK_UUID+'/deposits'],
    ['put',  '/v1/sandbox/bank_accounts/'+BANK_UUID],
    ['post', '/v1/sandbox/companies/'+COMPANY+'/bank_accounts/'+BANK_UUID+'/deposits'],
    ['post', '/v1/sandbox/companies/'+COMPANY+'/generate_bank_deposits'],
    ['post', '/v1/sandbox/bank_accounts/generate_deposits'],
  ];

  for (const [method, p] of paths) {
    const url = 'https://api.gusto-demo.com'+p;
    try {
      const r = await axios[method](url, {}, {headers:h});
      console.log('HIT! '+method.toUpperCase()+' '+p+' ->', JSON.stringify(r.data).slice(0,150));
    } catch(e) {
      const msg = (e.response?.data?.errors?.[0]?.message || '');
      const status = e.response?.status;
      if (status !== 404) {
        console.log('INTERESTING '+status+' '+method.toUpperCase()+' '+p+':', msg.slice(0,100));
      }
    }
  }
  console.log('Done probing sandbox endpoints');
}
run().catch(e => console.error(e.message));
