require('dotenv').config();
const axios = require('axios');
const fs = require('fs'), path = require('path');
const CLIENT_ID = 'j0BomohNFzn0Ytr7gO83w7t3eQMaXA6D9yuaa5KfG7I';
const CLIENT_SECRET = 'i4x2gp15nqWNnc-rsrj4Qfdv4kVUsuM8v1iyT_ou94U';
const COMPANY = process.env.GUSTO_PARTNER_COMPANY_UUID;

async function run() {
  const tok = await axios.post('https://api.gusto-demo.com/oauth/token',
    new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,grant_type:'refresh_token',refresh_token:process.env.GUSTO_PARTNER_COMPANY_REFRESH}).toString(),
    {headers:{'Content-Type':'application/x-www-form-urlencoded'}});
  const token = tok.data.access_token;
  const envPath = path.resolve(__dirname, '../.env');
  fs.writeFileSync(envPath, fs.readFileSync(envPath,'utf8').replace(/^GUSTO_PARTNER_COMPANY_REFRESH=.*/m, 'GUSTO_PARTNER_COMPANY_REFRESH='+tok.data.refresh_token), 'utf8');
  const h = {Authorization:'Bearer '+token, Accept:'application/json', 'Content-Type':'application/json', 'X-Gusto-API-Version':'2026-02-01'};

  // Onboarding status
  const co = await axios.get('https://api.gusto-demo.com/v1/companies/'+COMPANY+'/onboarding_status', {headers:h});
  console.log('Company onboarding_completed:', co.data.onboarding_completed);
  (co.data.onboarding_steps||[]).forEach(s => console.log('  ['+(s.completed?'X':' ')+'] '+s.id));

  // Get company bank accounts
  const ba = await axios.get('https://api.gusto-demo.com/v1/companies/'+COMPANY+'/bank_accounts', {headers:h});
  const accounts = Array.isArray(ba.data) ? ba.data : [];
  console.log('\nBank accounts:', accounts.length);
  accounts.forEach(a => console.log('  uuid:', a.uuid, 'verified:', a.verified, 'verification_type:', a.verification_type));

  // Try sandbox microdeposit amounts
  const testAmounts = [
    {deposit_1:'0.02', deposit_2:'0.42'},
    {deposit_1:'0.10', deposit_2:'0.10'},
    {deposit_1:'0.32', deposit_2:'0.45'},
  ];

  for (const acct of accounts) {
    if (!acct.verified) {
      console.log('\nAttempting verify bank account:', acct.uuid);
      for (const amounts of testAmounts) {
        try {
          const vr = await axios.put(
            'https://api.gusto-demo.com/v1/companies/'+COMPANY+'/bank_accounts/'+acct.uuid+'/verify',
            amounts, {headers:h});
          console.log('VERIFIED with', amounts, ':', JSON.stringify(vr.data));
          break;
        } catch(ve) {
          console.log('Failed', amounts, ':', ve.response?.data?.errors?.[0]?.message || JSON.stringify(ve.response?.data));
        }
      }
    }
  }

  // Generate verify_bank_info flow URL
  try {
    const r = await axios.post('https://api.gusto-demo.com/v1/companies/'+COMPANY+'/flows', {flow_type:'verify_bank_info'}, {headers:h});
    console.log('\nVERIFY BANK INFO FLOW URL:', r.data.url);
  } catch(e) {
    console.log('verify_bank_info flow error:', JSON.stringify(e.response?.data));
  }
}
run().catch(e => console.error(e.response?.data || e.message));
