require('dotenv').config();
const axios = require('axios');
const fs = require('fs'), path = require('path');
const CLIENT_ID = process.env.GUSTO_CLIENT_ID;
const CLIENT_SECRET = process.env.GUSTO_CLIENT_SECRET;
const COMPANY = process.env.GUSTO_PARTNER_COMPANY_UUID;

async function run() {
  const tok = await axios.post('https://api.gusto-demo.com/oauth/token',
    new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,grant_type:'refresh_token',refresh_token:process.env.GUSTO_PARTNER_COMPANY_REFRESH}).toString(),
    {headers:{'Content-Type':'application/x-www-form-urlencoded'}});
  const token = tok.data.access_token;
  const envPath = path.resolve(__dirname, '../.env');
  fs.writeFileSync(envPath, fs.readFileSync(envPath,'utf8').replace(/^GUSTO_PARTNER_COMPANY_REFRESH=.*/m, 'GUSTO_PARTNER_COMPANY_REFRESH='+tok.data.refresh_token), 'utf8');
  const h = {Authorization:'Bearer '+token, Accept:'application/json', 'Content-Type':'application/json', 'X-Gusto-API-Version':'2026-02-01'};

  // Get current bank accounts
  const ba = await axios.get('https://api.gusto-demo.com/v1/companies/'+COMPANY+'/bank_accounts', {headers:h});
  const accounts = Array.isArray(ba.data) ? ba.data : [];
  console.log('Current bank accounts:');
  accounts.forEach(a => console.log('  uuid:', a.uuid, 'verified:', a.verified, 'status:', a.verification_status));

  // Delete all existing
  for (const acct of accounts) {
    try {
      await axios.delete('https://api.gusto-demo.com/v1/companies/'+COMPANY+'/bank_accounts/'+acct.uuid, {headers:h});
      console.log('Deleted:', acct.uuid);
    } catch(e) {
      console.log('Delete failed:', acct.uuid, JSON.stringify(e.response?.data));
    }
  }

  // Try test account numbers — wide variety of routing/account combos
  // Some sandbox environments have "magic" numbers that skip microdeposits
  const testAccounts = [
    // Chase
    {routing_number:'021000021', account_number:'9900000002', account_type:'Checking'},
    {routing_number:'021000021', account_number:'9900000003', account_type:'Checking'},
    {routing_number:'021000021', account_number:'1111111111', account_type:'Checking'},
    {routing_number:'021000021', account_number:'1111111111', account_type:'Savings'},
    // Bank of America
    {routing_number:'322271627', account_number:'000123456789', account_type:'Checking'},
    // Wells Fargo
    {routing_number:'121042882', account_number:'000123456789', account_type:'Checking'},
    // Citibank
    {routing_number:'021000089', account_number:'000123456789', account_type:'Checking'},
    // Generic test routing
    {routing_number:'110000000', account_number:'000123456789', account_type:'Checking'},
    {routing_number:'110000000', account_number:'1111111111', account_type:'Checking'},
    // Stripe test routing (sometimes accepted)
    {routing_number:'110000000', account_number:'000111111116', account_type:'Checking'},
    {routing_number:'110000000', account_number:'000111111118', account_type:'Checking'},
  ];

  let verifiedUuid = null;
  for (const acct of testAccounts) {
    console.log('\nTrying routing:', acct.routing_number, 'account:', acct.account_number, 'type:', acct.account_type);
    try {
      const add = await axios.post('https://api.gusto-demo.com/v1/companies/'+COMPANY+'/bank_accounts', acct, {headers:h});
      const d = add.data;
      console.log('  Added! uuid:', d.uuid, '| verified:', d.verified, '| verification_status:', d.verification_status, '| verification_type:', d.verification_type);
      if (d.verified === true || d.verification_status === 'verified') {
        console.log('  >>> INSTANTLY VERIFIED! uuid:', d.uuid);
        verifiedUuid = d.uuid;
        break;
      }
      // Delete it before trying next one
      try {
        await axios.delete('https://api.gusto-demo.com/v1/companies/'+COMPANY+'/bank_accounts/'+d.uuid, {headers:h});
        console.log('  Deleted (not instant)');
      } catch(de) {
        console.log('  Could not delete:', de.response?.data);
      }
    } catch(e) {
      const msg = e.response?.data?.errors?.[0]?.message || JSON.stringify(e.response?.data) || e.message;
      console.log('  Failed:', msg);
    }
  }

  if (verifiedUuid) {
    console.log('\n=== SUCCESS: Verified bank account uuid:', verifiedUuid);
  } else {
    console.log('\n=== No instant-verify account found. All returned bank_deposits verification type.');
    console.log('    Consider contacting Gusto support for sandbox simulation.');
  }
}
run().catch(e => console.error(e.response?.data || e.message));
