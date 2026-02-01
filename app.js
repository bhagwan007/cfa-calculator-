/* =========================================================
   PRECISION
========================================================= */
function q8(x) { return Math.round(x * 1e8) / 1e8; }
function q4(x) { return Math.round(x * 1e4) / 1e4; }

/* =========================================================
   NUMBER STATE
========================================================= */
const numberState = {
  raw: "0",
  value: 0
};

function sync() {
  const v = parseFloat(numberState.raw);
  numberState.value = q8(isNaN(v) ? 0 : v);
  render();
}

function setNumber(v) {
  numberState.value = q8(v);
  numberState.raw = String(numberState.value);
  render();
}

/* =========================================================
   ENTRY
========================================================= */
function enterDigit(d) {
  numberState.raw = numberState.raw === "0" ? d : numberState.raw + d;
  sync();
}

function enterDecimal() {
  if (!numberState.raw.includes(".")) {
    numberState.raw += ".";
    sync();
  }
}

function toggleSign() {
  setNumber(-numberState.value);
}

/* =========================================================
   COMPACT DISPLAY (k / m / b)
========================================================= */
function formatCompact(v) {
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";

  if (a >= 1e9)
    return s + (a / 1e9).toFixed(9).replace(/0+$/, "").replace(/\.$/, "") + "b";
  if (a >= 1e6)
    return s + (a / 1e6).toFixed(6).replace(/0+$/, "").replace(/\.$/, "") + "m";
  if (a >= 1e3)
    return s + (a / 1e3).toFixed(6).replace(/0+$/, "").replace(/\.$/, "") + "k";

  return s + q4(a).toFixed(4);
}

/* =========================================================
   WORDS DISPLAY
========================================================= */
const digitWords = [
  "zero","one","two","three","four",
  "five","six","seven","eight","nine"
];

function integerToWords(n) {
  if (n === 0) return "zero";

  const units = [
    [1e9, "billion"],
    [1e6, "million"],
    [1e3, "thousand"]
  ];

  let r = "";
  for (const [v, w] of units) {
    if (n >= v) {
      r += Math.floor(n / v) + " " + w + " ";
      n %= v;
    }
  }
  if (n > 0) r += n;
  return r.trim();
}

function words() {
  const val = q4(numberState.value).toFixed(4);
  const [i, d] = val.split(".");
  const sign = numberState.value < 0 ? "minus " : "";
  return (
    sign +
    integerToWords(Math.abs(parseInt(i))) +
    " point " +
    d.split("").map(x => digitWords[x]).join(" ")
  );
}

/* =========================================================
   TVM STATE
========================================================= */
const tvmState = {
  N: 0,
  IY: 0,
  PV: 0,
  PMT: 0,
  FV: 0,
  PY: 1,
  CY: 1,
  mode: "END"
};

const worksheetState = {
  active: "TVM",
  cursor: 0
};

const tvmFields = ["N", "I/Y", "PV", "PMT", "FV"];

function currentTVMField() {
  return tvmFields[worksheetState.cursor];
}

/* =========================================================
   TVM HELPERS
========================================================= */
function periodicRate() {
  return q8((tvmState.IY / 100) / tvmState.CY);
}

function totalPeriods() {
  return q8(tvmState.N * (tvmState.PY / tvmState.CY));
}

function annuityFactor(r, n) {
  let af = q8((1 - Math.pow(1 + r, -n)) / r);
  if (tvmState.mode === "BGN") af = q8(af * (1 + r));
  return af;
}

/* =========================================================
   TVM COMPUTE
========================================================= */
function computeFV() {
  const r = periodicRate();
  const n = totalPeriods();
  tvmState.FV = q8(
    tvmState.PV * Math.pow(1 + r, n) +
    tvmState.PMT * annuityFactor(r, n)
  );
  setNumber(tvmState.FV);
}

function computePV() {
  const r = periodicRate();
  const n = totalPeriods();
  tvmState.PV = q8(
    (tvmState.FV - tvmState.PMT * annuityFactor(r, n)) /
    Math.pow(1 + r, n)
  );
  setNumber(tvmState.PV);
}

function computePMT() {
  const r = periodicRate();
  const n = totalPeriods();
  tvmState.PMT = q8(
    (tvmState.FV - tvmState.PV * Math.pow(1 + r, n)) /
    annuityFactor(r, n)
  );
  setNumber(tvmState.PMT);
}

/* =========================================================
   CASH FLOW / IRR / NPV
========================================================= */
const cfState = {
  flows: []
};

function setCashFlows(arr) {
  cfState.flows = arr.map(v => q8(v));
}

function computeNPV(ratePct) {
  const r = q8(ratePct / 100);
  let npv = 0;
  for (let t = 0; t < cfState.flows.length; t++) {
    npv = q8(npv + cfState.flows[t] / Math.pow(1 + r, t));
  }
  return npv;
}

function computeIRR() {
  let low = -0.9999, high = 10, mid = 0;
  for (let i = 0; i < 200; i++) {
    mid = q8((low + high) / 2);
    let npv = 0;
    for (let t = 0; t < cfState.flows.length; t++) {
      npv = q8(npv + cfState.flows[t] / Math.pow(1 + mid, t));
    }
    if (Math.abs(npv) < 1e-8) return q8(mid * 100);
    npv > 0 ? (low = mid) : (high = mid);
  }
  return q8(mid * 100);
}

/* =========================================================
   RENDER
========================================================= */
function render() {
  document.getElementById("numeric").innerText =
    formatCompact(numberState.value);
  document.getElementById("words").innerText = words();

  const bgn = document.getElementById("ind-bgn");
  if (bgn) bgn.classList.toggle("active", tvmState.mode === "BGN");
}

/* =========================================================
   KEY HANDLER
========================================================= */
document.querySelectorAll("button").forEach(btn => {
  btn.onclick = () => {
    const k = btn.dataset.key;

    if ("0123456789".includes(k)) enterDigit(k);
    else if (k === ".") enterDecimal();
    else if (k === "±") toggleSign();
    else if (k === "CLR") { numberState.raw = "0"; sync(); }

    // TVM store
    else if (["N","I/Y","PV","PMT","FV"].includes(k)) {
      worksheetState.cursor = tvmFields.indexOf(k);
      tvmState[k.replace("/","")] = numberState.value;
    }

    // CPT
    else if (k === "CPT") {
      const f = currentTVMField();
      if (f === "FV") computeFV();
      if (f === "PV") computePV();
      if (f === "PMT") computePMT();
    }

    // Navigation
    else if (k === "UP")
      worksheetState.cursor = Math.max(0, worksheetState.cursor - 1);
    else if (k === "DOWN")
      worksheetState.cursor = Math.min(tvmFields.length - 1, worksheetState.cursor + 1);

    else if (k === "ENTER") {
      const f = currentTVMField();
      tvmState[f.replace("/","")] = numberState.value;
    }

    // BGN
    else if (k === "BGN") {
      tvmState.mode = tvmState.mode === "END" ? "BGN" : "END";
      render();
    }

    // CF / IRR / NPV
    else if (k === "IRR") {
      setNumber(computeIRR());
    }
    else if (k === "NPV") {
      setNumber(computeNPV(numberState.value));
    }
  };
});

render();
