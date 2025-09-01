// Helpers
const $ = (sel) => document.querySelector(sel);
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const pct = (n) => `${(n).toFixed(2)}%`;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function toNum(input) {
  const v = parseFloat(input.value);
  return Number.isFinite(v) ? v : 0;
}

function getParams() {
  const u = new URL(location.href);
  return Object.fromEntries(u.searchParams.entries());
}
function setParams(params) {
  const u = new URL(location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v === '' || v == null) u.searchParams.delete(k);
    else u.searchParams.set(k, v);
  });
  history.replaceState({}, '', u.toString());
}

// Inputs
const custName = $('#custName');
const projAddr = $('#projAddr');
const startDate = $('#startDate');
const amount = $('#amount');
const down = $('#down');
const otherFees = $('#otherFees');
const prepaidFC = $('#prepaidFC');
const apr = $('#apr');
const term = $('#term');
const lateFee = $('#lateFee');
const graceDays = $('#graceDays');
const prepayPen = $('#prepayPen');
const secInterest = $('#secInterest');

// Outputs
const amountFinanced = $('#amountFinanced');
const monthly = $('#monthly');
const totalPaid = $('#totalPaid');
const totalInterest = $('#totalInterest');
const financeCharge = $('#financeCharge');
const tilaAPR = $('#tilaAPR');
const payoffDate = $('#payoffDate');
const tbody = $('#schedule tbody');

// TILA box fields
const tila_apr = $('#tila_apr');
const tila_fc = $('#tila_fc');
const tila_af = $('#tila_af');
const tila_top = $('#tila_top');
const tila_sched = $('#tila_sched');
const tila_name = $('#tila_name');
const tila_addr = $('#tila_addr');
const tila_first = $('#tila_first');
const tila_final = $('#tila_final');
const tila_late = $('#tila_late');
const tila_prepay = $('#tila_prepay');
const tila_sec = $('#tila_sec');

// Buttons
const themeToggle = $('#themeToggle');
const copyLink = $('#copyLink');
const resetBtn = $('#reset');
const printDisclosure = $('#printDisclosure');

// Theme
themeToggle?.addEventListener('click', () => {
  document.body.classList.toggle('light');
});

// Presets
document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => {
    amount.value = btn.dataset.amount || amount.value;
    term.value = btn.dataset.term || term.value;
    apr.value = btn.dataset.apr || apr.value;
    down.value = '0';
    otherFees.value = '0';
    prepaidFC.value = '0';
    calculate();
  });
});

// Copy link
copyLink?.addEventListener('click', async () => {
  const params = {
    name: custName.value,
    addr: projAddr.value,
    start: startDate.value,
    amount: amount.value,
    down: down.value,
    other: otherFees.value,
    pfc: prepaidFC.value,
    apr: apr.value,
    term: term.value,
    late: lateFee.value,
    grace: graceDays.value,
    prepay: prepayPen.value,
    sec: secInterest.value
  };
  setParams(params);
  try {
    await navigator.clipboard.writeText(location.href);
    copyLink.textContent = 'Link copied ✓';
    setTimeout(() => (copyLink.textContent = 'Copy shareable link'), 1500);
  } catch {
    alert('Copy failed. Long-press the address bar to share.');
  }
});

// Reset
resetBtn?.addEventListener('click', () => {
  [custName, projAddr].forEach(el => (el.value = ''));
  startDate.value = '';
  amount.value = 8000;
  down.value = 0;
  otherFees.value = 0;
  prepaidFC.value = 0;
  apr.value = 6.5;
  term.value = 12;
  lateFee.value = 25;
  graceDays.value = 10;
  prepayPen.value = 'none';
  secInterest.value = 'D Fence retains lien rights until paid in full.';
  calculate();
});

// Print
printDisclosure?.addEventListener('click', () => window.print());

// Load from URL params on start
(function initFromURL() {
  const p = getParams();
  if (p.name) custName.value = p.name;
  if (p.addr) projAddr.value = p.addr;
  if (p.start) startDate.value = p.start;
  if (p.amount) amount.value = p.amount;
  if (p.down) down.value = p.down;
  if (p.other) otherFees.value = p.other;
  if (p.pfc) prepaidFC.value = p.pfc;
  if (p.apr) apr.value = p.apr;
  if (p.term) term.value = p.term;
  if (p.late) lateFee.value = p.late;
  if (p.grace) graceDays.value = p.grace;
  if (p.prepay) prepayPen.value = p.prepay;
  if (p.sec) secInterest.value = p.sec;
})();

// Recalculate on input
[
  custName, projAddr, startDate, amount, down, otherFees, prepaidFC,
  apr, term, lateFee, graceDays, prepayPen, secInterest
].forEach(el => el.addEventListener('input', calculate));

function calculate() {
  const A = toNum(amount);
  const D = toNum(down);
  const OF = toNum(otherFees);          // Non-finance fees that are financed
  const PFC = toNum(prepaidFC);         // Prepaid finance charges (paid up-front)
  const N = Math.max(1, Math.floor(toNum(term)));
  const APR_nominal = Math.max(0, toNum(apr));
  const r = APR_nominal / 12 / 100;

  // Amounts
  const principalFinancedBase = Math.max(0, round2(A - D + OF)); // base principal schedule
  const amountFin = Math.max(0, round2(principalFinancedBase - PFC)); // TILA "Amount Financed"

  // Payment (if r==0, equal payments on base principal)
  let payment = (r === 0) ? round2(principalFinancedBase / N)
    : round2((principalFinancedBase * r) / (1 - Math.pow(1 + r, -N)));

  // Amortization
  tbody.innerHTML = '';
  let balance = principalFinancedBase;
  let interestTotal = 0;
  const start = startDate.value ? new Date(startDate.value) : new Date();

  for (let i = 1; i <= N; i++) {
    const interest = round2(balance * r);
    let principalPaid = round2(payment - interest);

    if (i === N) {
      principalPaid = round2(balance);
      payment = round2(principalPaid + interest);
    } else {
      principalPaid = Math.min(principalPaid, round2(balance));
    }

    balance = round2(balance - principalPaid);
    interestTotal = round2(interestTotal + interest);

    const due = new Date(start);
    due.setMonth(due.getMonth() + (i - 1));
    const dueStr = due.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i}</td>
      <td>${fmt.format(payment)}</td>
      <td>${fmt.format(interest)}</td>
      <td>${fmt.format(principalPaid)}</td>
      <td>${fmt.format(balance)}</td>
      <td>${dueStr}</td>
    `;
    tbody.appendChild(tr);
  }

  // Totals
  const totalPaymentsStream = Array.from(tbody.querySelectorAll('tr')).reduce((sum, tr) => {
    const cell = tr.children[1].textContent.replace(/[^0-9.\-]/g, '');
    return sum + parseFloat(cell);
  }, 0);
  const financeChargeTotal = round2(interestTotal + PFC);
  const totalOfPaymentsVal = round2(totalPaymentsStream + PFC);

  // TILA APR via IRR on cash flows (amount financed at t0, payments t1..tN)
  const i_m = solveMonthlyRate(amountFin, getPaymentAmounts());
  const tilaAprPct = isFinite(i_m) ? (i_m * 12 * 100) : 0;

  // Outputs
  amountFinanced.textContent = fmt.format(amountFin);
  monthly.textContent = tbody.children.length ? tbody.children[0].children[1].textContent : fmt.format(0);
  totalPaid.textContent = fmt.format(totalOfPaymentsVal);
  totalInterest.textContent = fmt.format(interestTotal);
  financeCharge.textContent = fmt.format(financeChargeTotal);
  tilaAPR.textContent = `${tilaAprPct.toFixed(2)}%`;

  const payoff = startDate.value ? new Date(startDate.value) : new Date();
  payoff.setMonth(payoff.getMonth() + (N - 1));
  payoffDate.textContent = payoff.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });

  // Fill TILA box
  tila_apr.textContent = `${tilaAprPct.toFixed(2)}%`;
  tila_fc.textContent = fmt.format(financeChargeTotal);
  tila_af.textContent = fmt.format(amountFin);
  tila_top.textContent = fmt.format(totalOfPaymentsVal);

  const firstDue = startDate.value ? new Date(startDate.value) : new Date();
  const finalDue = new Date(firstDue);
  finalDue.setMonth(finalDue.getMonth() + (N - 1));

  tila_sched.textContent = `${N} monthly payment${N>1?'s':''} of ${monthly.textContent}`;
  tila_name.textContent = custName.value || '—';
  tila_addr.textContent = projAddr.value || '—';
  tila_first.textContent = firstDue.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  tila_final.textContent = finalDue.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  tila_late.textContent = lateFee.value
    ? `$${Number(lateFee.value).toFixed(2)} after ${graceDays.value} day(s) past due.`
    : `No late fee specified.`;
  tila_prepay.textContent = prepayPen.value === 'penalty'
    ? `Prepayment penalty applies per agreement.`
    : `No penalty. Interest savings may apply.`;
  tila_sec.textContent = secInterest.value || '—';

  // helpers
  function getPaymentAmounts() {
    const pays = [];
    for (let i = 0; i < N; i++) {
      const row = tbody.children[i];
      if (!row) break;
      const p = parseFloat(row.children[1].textContent.replace(/[^0-9.\-]/g, '')) || 0;
      pays.push(p);
    }
    return pays;
  }

  // Solve monthly rate by binary search so PV(payments, i) = amountFin
  function solveMonthlyRate(PVtarget, payments) {
    if (PVtarget <= 0 || payments.length === 0) return 0;
    // Edge: if all payments equal and APR nominal is 0, still solve; if PFC>0, APR>0
    let lo = 0, hi = 1.0; // 0% to 100% per month search range
    const f = (i) => {
      let pv = 0;
      for (let k = 0; k < payments.length; k++) {
        pv += payments[k] / Math.pow(1 + i, k + 1);
      }
      return pv;
    };
    const tol = 1e-10;
    for (let iter = 0; iter < 200; iter++) {
      const mid = (lo + hi) / 2;
      const pv = f(mid);
      if (Math.abs(pv - PVtarget) < 1e-6) return mid;
      if (pv > PVtarget) lo = mid; else hi = mid;
      if (Math.abs(hi - lo) < tol) return mid;
    }
    return (lo + hi) / 2;
  }
}

// Initial compute
calculate();
