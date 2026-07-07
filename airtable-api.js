// RoofScan UK — Airtable API Module
// Include this in any page that needs live Airtable data
// Token stored in localStorage as 'rs_at_token'

const AT = (function() {
  const BASE_ID = 'appPATYbyCttGeTCL';
  const BASE_URL = 'https://api.airtable.com/v0';

  // Table IDs
  const TABLES = {
    jobs:     'tbldFSer2uWycCZ0z',
    quotes:   'tblGiVdQ8s6tq8u3a',
    trade:    'tblewRzIhi4HReWmE',
    outreach: 'tblZxQIsc5DqLl8X5',
    careplans:'tblQbtLYU2WR6ZlzK',
    settings: 'tblkH7q5OEevbrxLD',
  };

  // Field IDs
  const FIELDS = {
    jobs: {
      ref:      'fld0ODMcxPUquCZKB',
      client:   'fld8R0gd2hcYSnmi5',
      address:  'fldk2TDM0kE3BJkc3',
      email:    'fldz2TUtjkaWlhxUA',
      phone:    'fldGmegM4b4IQ6R5a',
      propType: 'fldTecfNE5C0HTUYP',
      total:    'fldXzq5NYyyG0m33G',
      deposit:  'fld1finCrVEj0yE4C',
      date:     'fldmMdTOz2ieZ74e3',
      status:   'fldhm3oLpNvtD8Thc',
      notes:    'fldvym9yUybOyvoq4',
      report:   'fldenMqINAf6DcCO7',
      roofscore:'fldCWxHxCghBnjemX',
      company:  'fldkibwZ0z68rPMAl',
      payment:  'fldaq6odXbJ1UGKbi',
    },
    outreach: {
      name:    'fldVHCQKVJYK5vewS',
      company: 'fldQjO1kyEqRuCWGN',
      email:   'fldGms3NH1GyEvnHa',
      phone:   'fld8ffBqffBf18RwX',
      type:    'flddktft2aNUp3J0e',
      status:  'fldjNWwCC4TvIRtGk',
      notes:   'fldR8mEpPAbCypt7t',
      role:    'fldHWLQq9pg3v4J8Z',
    },
    trade: {
      company:   'fldIgyb7C5S4nhcGY',
      contact:   'fldzjXxbtlywWi52V',
      email:     'fldoJpCpGHaf4XwEF',
      phone:     'fldFWHcObSgYRg6tQ',
      curJobs:   'fld5QwOpTBX0jkrvt',
      prevJobs:  'fld6YkSwYUvTioSa2',
      status:    'fldGF3Bs4YjNYV52t',
      premium:   'fldBkH6NkqFZJgsLl',
    },
    quotes: {
      name:    'fldleT1HcAzDiIjeh',
      email:   'fld5vaQpMDWU8VaK6',
      address: 'fld4RhxrCd98l01xv',
      propType:'fldVkic6vKqR4iDhV',
      total:   'fld3YxgQtZvTbY3Nj',
      time:    'fldYagNJasdszFy8z',
      status:  'fldXYDjeSFwwFPmRI',
    },
    careplans: {
      client:   'fldkkXM7fxh5AUAI3',
      address:  'fldWAHmgIsakmMLHc',
      propType: 'fldHDNOsoU6FoJxim',
      rate:     'fldpj8Fb5jBtJShLl',
      nextDue:  'fld0YCFSCOIqWsZ2g',
      status:   'fldvPBWGDgnl6kyKd',
      lastInsp: 'fldlbSCJ4MHNH043F',
    }
  };

  // Job status options (ordered workflow)
  const JOB_STATUSES = [
    {name:'Booked',      color:'#2980B9', bg:'#EAF4FB'},
    {name:'Complete',    color:'#E67E22', bg:'#FEF3E2'},
    {name:'Report Sent', color:'#27AE60', bg:'#E8F8EF'},
    {name:'Paid',        color:'#1D8348', bg:'#D5F5E3'},
  ];

  const OUTREACH_STATUSES = [
    {name:'To Contact',     color:'#6B7A8D', bg:'#F0F4F8'},
    {name:'Emailed',        color:'#2980B9', bg:'#EAF4FB'},
    {name:'Responded',      color:'#8E44AD', bg:'#F5EEF8'},
    {name:'Meeting Booked', color:'#E67E22', bg:'#FEF3E2'},
    {name:'Account Set Up', color:'#27AE60', bg:'#E8F8EF'},
    {name:'Not Interested', color:'#C0392B', bg:'#FDECEA'},
  ];

  // Token management
  function getToken() { try { return localStorage.getItem('rs_at_token') || ''; } catch(e) { return ''; } }
  function setToken(t) { try { localStorage.setItem('rs_at_token', t); } catch(e) {} }
  function hasToken() { return !!getToken(); }

  // Cache management (session-level, clears on close)
  const cache = {};
  function cacheKey(tableId, params) { return tableId + JSON.stringify(params); }
  function fromCache(key) {
    const c = cache[key];
    if (c && Date.now() - c.ts < 30000) return c.data; // 30 second cache
    return null;
  }
  function toCache(key, data) { cache[key] = {data, ts: Date.now()}; }

  // Core API request
  async function request(method, path, body) {
    const token = getToken();
    if (!token) throw new Error('No API token');
    const opts = {
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE_URL + '/' + BASE_ID + '/' + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'API error ' + res.status);
    }
    return res.json();
  }

  // List records from a table
  async function listRecords(tableId, fields, filterFormula, sort, maxRecords) {
    const key = cacheKey(tableId, {fields, filterFormula, sort});
    const cached = fromCache(key);
    if (cached) return cached;

    let url = tableId + '?';
    if (fields) fields.forEach(f => url += 'fields[]=' + encodeURIComponent(f) + '&');
    if (filterFormula) url += 'filterByFormula=' + encodeURIComponent(filterFormula) + '&';
    if (sort) sort.forEach((s,i) => {
      url += 'sort[' + i + '][field]=' + encodeURIComponent(s.field) + '&';
      url += 'sort[' + i + '][direction]=' + (s.dir||'asc') + '&';
    });
    if (maxRecords) url += 'maxRecords=' + maxRecords + '&';

    // Paginate
    let allRecords = [];
    let offset = null;
    do {
      const pageUrl = url + (offset ? 'offset=' + offset : '');
      const data = await request('GET', pageUrl);
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset;
    } while (offset && allRecords.length < (maxRecords || 999));

    toCache(key, allRecords);
    return allRecords;
  }

  // Update a record
  async function updateRecord(tableId, recordId, fields) {
    // Invalidate cache
    Object.keys(cache).forEach(k => { if (k.startsWith(tableId)) delete cache[k]; });
    return request('PATCH', tableId + '/' + recordId, {fields});
  }

  // Create a record
  async function createRecord(tableId, fields) {
    Object.keys(cache).forEach(k => { if (k.startsWith(tableId)) delete cache[k]; });
    return request('POST', tableId, {fields});
  }

  // ─── HIGH-LEVEL HELPERS ──────────────────────────────────────────

  // Get jobs that need reports (Booked or Complete — not yet Report Sent or Paid)
  async function getJobsNeedingReport() {
    return listRecords(
      TABLES.jobs,
      [FIELDS.jobs.client, FIELDS.jobs.address, FIELDS.jobs.propType, FIELDS.jobs.status, FIELDS.jobs.date, FIELDS.jobs.total, FIELDS.jobs.roofscore, FIELDS.jobs.notes],
      "OR({Status}='Booked',{Status}='Complete')",
      [{field:'Inspection Date', dir:'desc'}],
      30
    );
  }

  // Get today's jobs
  async function getTodaysJobs() {
    const today = new Date().toISOString().slice(0,10);
    return listRecords(
      TABLES.jobs,
      [FIELDS.jobs.client, FIELDS.jobs.address, FIELDS.jobs.propType, FIELDS.jobs.status, FIELDS.jobs.date, FIELDS.jobs.roofscore, FIELDS.jobs.total, FIELDS.jobs.notes],
      "IS_SAME({Inspection Date}, TODAY(), 'day')",
      [{field: 'Inspection Date', dir: 'asc'}]
    );
  }

  // Get all active jobs (not yet Paid)
  async function getActiveJobs() {
    return listRecords(
      TABLES.jobs,
      [FIELDS.jobs.client, FIELDS.jobs.address, FIELDS.jobs.propType, FIELDS.jobs.status, FIELDS.jobs.date, FIELDS.jobs.roofscore, FIELDS.jobs.total, FIELDS.jobs.payment],
      "AND({Status}!='Paid')",
      [{field: 'Inspection Date', dir: 'desc'}],
      50
    );
  }

  // Get recent jobs (last 30 days)
  async function getRecentJobs(max) {
    return listRecords(
      TABLES.jobs,
      [FIELDS.jobs.client, FIELDS.jobs.address, FIELDS.jobs.propType, FIELDS.jobs.status, FIELDS.jobs.date, FIELDS.jobs.roofscore, FIELDS.jobs.total],
      null,
      [{field: 'Inspection Date', dir: 'desc'}],
      max || 20
    );
  }

  // Get outreach contacts
  async function getOutreachContacts(statusFilter) {
    const formula = statusFilter ? "{Status}='" + statusFilter + "'" : '';
    return listRecords(
      TABLES.outreach,
      [FIELDS.outreach.name, FIELDS.outreach.company, FIELDS.outreach.email, FIELDS.outreach.phone, FIELDS.outreach.type, FIELDS.outreach.status, FIELDS.outreach.role],
      formula,
      [{field: 'Status', dir: 'asc'}, {field: 'Company', dir: 'asc'}]
    );
  }

  // Get recent quotes
  async function getRecentQuotes(max) {
    return listRecords(
      TABLES.quotes,
      [FIELDS.quotes.name, FIELDS.quotes.address, FIELDS.quotes.propType, FIELDS.quotes.total, FIELDS.quotes.time, FIELDS.quotes.status],
      null,
      [{field: 'Timestamp', dir: 'desc'}],
      max || 10
    );
  }

  // Get trade accounts
  async function getTradeAccounts() {
    return listRecords(
      TABLES.trade,
      [FIELDS.trade.company, FIELDS.trade.contact, FIELDS.trade.email, FIELDS.trade.curJobs, FIELDS.trade.status, FIELDS.trade.premium],
      "{Account Status}='Active'",
      [{field: 'Current Month Jobs', dir: 'desc'}]
    );
  }

  // Get care plan clients due soon
  async function getUpcomingCarePlans() {
    return listRecords(
      TABLES.careplans,
      [FIELDS.careplans.client, FIELDS.careplans.address, FIELDS.careplans.propType, FIELDS.careplans.nextDue, FIELDS.careplans.status],
      "{Status}='Active'",
      [{field: 'Next Due Date', dir: 'asc'}],
      20
    );
  }

  // Get smart alerts — overdue reports, unpaid jobs
  async function getAlerts() {
    const jobs = await listRecords(
      TABLES.jobs,
      [FIELDS.jobs.client, FIELDS.jobs.address, FIELDS.jobs.status, FIELDS.jobs.date, FIELDS.jobs.roofscore],
      null, null, 100
    );
    const now = new Date();
    const alerts = [];
    const twoDaysAgo = new Date(now.getTime() - 48*60*60*1000).toISOString().slice(0,10);

    jobs.forEach(function(j) {
      var f = j.fields;
      var status = f[FIELDS.jobs.status];
      var date = f[FIELDS.jobs.date];
      // Report overdue: Complete but no Report Sent, inspection was >48hrs ago
      if(status === 'Complete' && date && date <= twoDaysAgo) {
        alerts.push({type:'overdue', id:j.id, client:f[FIELDS.jobs.client]||'Client', date:fmtDate(date), msg:'Report overdue'});
      }
      // No RoofScore on Complete jobs
      if(status === 'Complete' && !f[FIELDS.jobs.roofscore]) {
        alerts.push({type:'noscore', id:j.id, client:f[FIELDS.jobs.client]||'Client', msg:'No RoofScore entered'});
      }
    });
    return alerts;
  }

  // Get hub summary stats
  async function getStats() {
    const [active, outreach, trade] = await Promise.all([
      listRecords(TABLES.jobs, [FIELDS.jobs.status, FIELDS.jobs.total, FIELDS.jobs.date], null, null, 200),
      listRecords(TABLES.outreach, [FIELDS.outreach.status], null, null, 200),
      listRecords(TABLES.trade, [FIELDS.trade.status], "{Account Status}='Active'", null, 50),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);

    const thisMonthJobs = active.filter(r => r.fields[FIELDS.jobs.date] >= monthStart);
    const paidThisMonth = thisMonthJobs.filter(r => r.fields[FIELDS.jobs.status] === 'Paid');
    const monthRevenue = paidThisMonth.reduce((s,r) => s + (r.fields[FIELDS.jobs.total] || 0), 0);
    const toContact = outreach.filter(r => r.fields[FIELDS.outreach.status] === 'To Contact').length;

    return {
      totalJobs: active.length,
      jobsThisMonth: thisMonthJobs.length,
      monthRevenue,
      outreachContacts: outreach.length,
      toContact,
      activeTradeAccounts: trade.length,
    };
  }

  // Update job status
  async function setJobStatus(recordId, status) {
    return updateRecord(TABLES.jobs, recordId, {[FIELDS.jobs.status]: status});
  }

  // Update job RoofScore
  async function setRoofScore(recordId, score) {
    return updateRecord(TABLES.jobs, recordId, {[FIELDS.jobs.roofscore]: score});
  }

  // Update outreach status
  async function setOutreachStatus(recordId, status) {
    return updateRecord(TABLES.outreach, recordId, {[FIELDS.outreach.status]: status});
  }

  // Create a new job record from the app
  async function createJob(data) {
    const fields = {};
    if (data.client)   fields[FIELDS.jobs.client]   = data.client;
    if (data.address)  fields[FIELDS.jobs.address]  = data.address;
    if (data.propType) fields[FIELDS.jobs.propType] = data.propType;
    if (data.date)     fields[FIELDS.jobs.date]     = data.date;
    if (data.total)    fields[FIELDS.jobs.total]    = parseFloat(data.total);
    if (data.roofscore) fields[FIELDS.jobs.roofscore] = parseInt(data.roofscore);
    if (data.notes)    fields[FIELDS.jobs.notes]    = data.notes;
    fields[FIELDS.jobs.status] = data.status || 'Booked';
    return createRecord(TABLES.jobs, fields);
  }

  // Formatters
  function fmt(n) { return '£' + (n||0).toLocaleString('en-GB', {minimumFractionDigits:0,maximumFractionDigits:0}); }
  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'});
  }
  function isToday(d) {
    if (!d) return false;
    return d === new Date().toISOString().slice(0,10);
  }
  function statusStyle(status) {
    const s = JOB_STATUSES.find(x => x.name === status);
    return s || {color:'#6B7A8D', bg:'#F0F4F8'};
  }
  function outreachStyle(status) {
    const s = OUTREACH_STATUSES.find(x => x.name === status);
    return s || {color:'#6B7A8D', bg:'#F0F4F8'};
  }


  // ─── EXTENDED HELPERS (full build) ──────────────────────────────

  // Update job notes (item 5 — notes sync)
  async function setJobNotes(recordId, notes) {
    return updateRecord(TABLES.jobs, recordId, {[FIELDS.jobs.notes]: notes});
  }

  // Append to job notes (preserves existing)
  async function appendJobNotes(recordId, newNote) {
    try {
      var res = await request('GET', TABLES.jobs + '/' + recordId);
      var existing = res.fields[FIELDS.jobs.notes] || '';
      var stamp = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      var combined = existing ? existing + '\n[' + stamp + '] ' + newNote : newNote;
      return updateRecord(TABLES.jobs, recordId, {[FIELDS.jobs.notes]: combined});
    } catch(e) { throw e; }
  }

  // Create a quote record (item 6 — manual quotes to Airtable)
  async function createQuote(data) {
    const fields = {};
    if (data.name)     fields[FIELDS.quotes.name]     = data.name;
    if (data.email)    fields[FIELDS.quotes.email]    = data.email;
    if (data.address)  fields[FIELDS.quotes.address]  = data.address;
    if (data.propType) fields[FIELDS.quotes.propType] = data.propType;
    if (data.total)    fields[FIELDS.quotes.total]    = parseFloat(data.total);
    fields[FIELDS.quotes.status] = data.status || 'Pending';
    return createRecord(TABLES.quotes, fields);
  }

  // Update flight data on a job (item 7 — flight log sync)
  async function setFlightData(recordId, notes) {
    return appendJobNotes(recordId, notes);
  }

  // Get all jobs at a specific address (item 17, 27 — history & comparison)
  async function getJobsAtAddress(address) {
    if(!address) return [];
    var streetPart = address.split(',')[0].trim().replace(/'/g, "\\'");
    return listRecords(
      TABLES.jobs,
      [FIELDS.jobs.client, FIELDS.jobs.address, FIELDS.jobs.status, FIELDS.jobs.date, FIELDS.jobs.roofscore, FIELDS.jobs.notes],
      "FIND('" + streetPart + "', {Property Address})",
      [{field:'Inspection Date', dir:'desc'}],
      20
    );
  }

  // Check if email is a returning client (item 28)
  async function findClientByEmail(email) {
    if(!email) return [];
    return listRecords(
      TABLES.jobs,
      [FIELDS.jobs.client, FIELDS.jobs.address, FIELDS.jobs.date, FIELDS.jobs.roofscore, FIELDS.jobs.email],
      "{Client Email}='" + email.replace(/'/g,"\\'") + "'",
      [{field:'Inspection Date', dir:'desc'}],
      10
    );
  }

  // Get conversion stats (item 32)
  async function getConversionStats() {
    const [quotes, jobs] = await Promise.all([
      listRecords(TABLES.quotes, [FIELDS.quotes.status], null, null, 200),
      listRecords(TABLES.jobs, [FIELDS.jobs.status], null, null, 200),
    ]);
    var totalQuotes = quotes.length;
    var converted = quotes.filter(function(q){return q.fields[FIELDS.quotes.status]==='Converted';}).length;
    var totalJobs = jobs.length;
    var rate = totalQuotes > 0 ? Math.round((converted/totalQuotes)*100) : 0;
    return {totalQuotes, converted, totalJobs, conversionRate: rate};
  }

  // Get common defects across all jobs (item 31)
  async function getDefectStats() {
    const jobs = await listRecords(TABLES.jobs, [FIELDS.jobs.notes, FIELDS.jobs.status], null, null, 200);
    var defectKeywords = {
      'Cracked tiles':/crack|broken tile|broken slate/i,
      'Slipped slates':/slip|missing tile|missing slate|displaced/i,
      'Blocked gutters':/gutter|blocked|debris|moss in/i,
      'Flashing issues':/flashing|lead|pointing/i,
      'Chimney defects':/chimney|stack|flaunching|pot/i,
      'Ridge problems':/ridge|hip tile|mortar/i,
    };
    var counts = {};
    Object.keys(defectKeywords).forEach(function(k){counts[k]=0;});
    jobs.forEach(function(j){
      var notes = j.fields[FIELDS.jobs.notes] || '';
      Object.keys(defectKeywords).forEach(function(k){
        if(defectKeywords[k].test(notes)) counts[k]++;
      });
    });
    return counts;
  }

  // Get referral leaderboard (item 37)
  async function getReferralStats() {
    const jobs = await listRecords(TABLES.jobs, ['fldtHVPeC3haY3gRy', FIELDS.jobs.status], "{Referred By}!=''", null, 200);
    var counts = {};
    jobs.forEach(function(j){
      var ref = j.fields['fldtHVPeC3haY3gRy'];
      if(ref) counts[ref] = (counts[ref]||0) + 1;
    });
    return Object.keys(counts).map(function(k){return {name:k, count:counts[k]};}).sort(function(a,b){return b.count-a.count;});
  }

  // Get Sussex average RoofScore from Settings (item 30)
  async function getSussexAverage() {
    try {
      const settings = await listRecords(TABLES.settings, ['fldSEgJ61Ows1tnIS'], null, null, 1);
      if(settings.length && settings[0].fields['fldSEgJ61Ows1tnIS']) {
        return settings[0].fields['fldSEgJ61Ows1tnIS'];
      }
    } catch(e) {}
    return 72; // sensible default
  }

  // Get upcoming care plan renewals (item 13)
  async function getCarePlanRenewals() {
    return listRecords(
      TABLES.careplans,
      [FIELDS.careplans.client, FIELDS.careplans.address, FIELDS.careplans.nextDue, FIELDS.careplans.status, FIELDS.careplans.lastInsp],
      "{Status}='Active'",
      [{field:'Next Due Date', dir:'asc'}],
      20
    );
  }

  // Duplicate a job (item 23)
  async function duplicateJob(recordId, newDate) {
    var res = await request('GET', TABLES.jobs + '/' + recordId);
    var f = res.fields;
    var newFields = {};
    [FIELDS.jobs.client, FIELDS.jobs.address, FIELDS.jobs.email, FIELDS.jobs.phone, FIELDS.jobs.propType, FIELDS.jobs.total, FIELDS.jobs.company].forEach(function(fid){
      if(f[fid] !== undefined) newFields[fid] = (f[fid] && f[fid].name) ? f[fid].name : f[fid];
    });
    newFields[FIELDS.jobs.status] = 'Booked';
    if(newDate) newFields[FIELDS.jobs.date] = newDate;
    return createRecord(TABLES.jobs, newFields);
  }

  // Batch update status (item 26)
  async function batchSetStatus(recordIds, status) {
    return Promise.all(recordIds.map(function(id){return setJobStatus(id, status);}));
  }

  // Get pipeline revenue forecast (item 20)
  async function getPipelineForecast() {
    const jobs = await listRecords(
      TABLES.jobs,
      [FIELDS.jobs.status, FIELDS.jobs.total, FIELDS.jobs.date],
      "{Status}!='Paid'",
      null, 100
    );
    var pipeline = jobs.reduce(function(s,j){return s+(j.fields[FIELDS.jobs.total]||0);},0);
    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const paidThisMonth = await listRecords(
      TABLES.jobs,
      [FIELDS.jobs.total, FIELDS.jobs.date],
      "AND({Status}='Paid',IS_AFTER({Inspection Date},'" + monthStart + "'))",
      null, 100
    );
    var earned = paidThisMonth.reduce(function(s,j){return s+(j.fields[FIELDS.jobs.total]||0);},0);
    return {pipeline, earned, projected: earned + pipeline};
  }

  // Expose public API
  return {
    TABLES, FIELDS, JOB_STATUSES, OUTREACH_STATUSES,
    getToken, setToken, hasToken,
    listRecords, updateRecord, createRecord,
    getTodaysJobs, getActiveJobs, getRecentJobs, getJobsNeedingReport,
    getOutreachContacts, getRecentQuotes, getTradeAccounts,
    getUpcomingCarePlans, getStats,
    setJobStatus, setRoofScore, setOutreachStatus, createJob, getJobsNeedingReport, getAlerts,
    setJobNotes, appendJobNotes, createQuote, setFlightData,
    getJobsAtAddress, findClientByEmail, getConversionStats, getDefectStats,
    getReferralStats, getSussexAverage, getCarePlanRenewals, duplicateJob,
    batchSetStatus, getPipelineForecast,
    fmt, fmtDate, isToday, statusStyle, outreachStyle,
  };
})();
