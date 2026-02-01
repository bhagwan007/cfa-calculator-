/* =========================================================
   PRECISION
========================================================= */
function q8(x){ return Math.round(x * 1e8) / 1e8 }
function q4(x){ return Math.round(x * 1e4) / 1e4 }

/* =========================================================
   NUMBER STATE
========================================================= */
const numberState = { raw:"0", value:0 }
function sync(){
  numberState.value = q8(parseFloat(numberState.raw) || 0)
  render()
}
function setNumber(v){
  numberState.value = q8(v)
  numberState.raw = String(numberState.value)
  render()
}

/* =========================================================
   ENTRY
========================================================= */
function enterDigit(d){
  if(calcState.waiting){
    numberState.raw = d
    calcState.waiting = false
  } else {
    numberState.raw = numberState.raw==="0" ? d : numberState.raw+d
  }
  sync()
}
function enterDecimal(){
  if(!numberState.raw.includes(".")){
    numberState.raw += "."
    sync()
  }
}
function backspace(){
  numberState.raw =
    numberState.raw.length>1 ? numberState.raw.slice(0,-1) : "0"
  sync()
}
function toggleSign(){ setNumber(-numberState.value) }

/* =========================================================
   ARITHMETIC ENGINE (FIXES YOUR BUG)
========================================================= */
const calcState = {
  acc:null,
  op:null,
  waiting:false
}

function applyOp(a,b,op){
  if(op==="+") return q8(a+b)
  if(op==="-") return q8(a-b)
  if(op==="*") return q8(a*b)
  if(op==="/") return b===0 ? NaN : q8(a/b)
  return b
}

function pressOperator(op){
  if(calcState.acc===null){
    calcState.acc = numberState.value
  } else if(!calcState.waiting){
    calcState.acc = applyOp(calcState.acc, numberState.value, calcState.op)
    setNumber(calcState.acc)
  }
  calcState.op = op
  calcState.waiting = true
}

function pressEquals(){
  if(calcState.op===null) return
  const res = applyOp(calcState.acc, numberState.value, calcState.op)
  setNumber(res)
  calcState.acc = null
  calcState.op = null
  calcState.waiting = false
}

function clearAll(){
  numberState.raw="0"; numberState.value=0
  calcState.acc=null; calcState.op=null; calcState.waiting=false
  render()
}

/* =========================================================
   MEMORY (STO / RCL)
========================================================= */
let memory = 0
function store(){ memory = numberState.value }
function recall(){ setNumber(memory) }

/* =========================================================
   2nd / LN / e^x
========================================================= */
let second = false
function toggleSecond(){ second = !second }

function pressLN(){
  if(second){
    setNumber(q8(Math.exp(numberState.value)))
    second=false
  } else {
    setNumber(q8(Math.log(numberState.value)))
  }
}

/* =========================================================
   COMPACT DISPLAY
========================================================= */
function formatCompact(v){
  const a=Math.abs(v), s=v<0?"-":""
  if(a>=1e9) return s+(a/1e9).toFixed(9).replace(/0+$/,"").replace(/\.$/,"")+"b"
  if(a>=1e6) return s+(a/1e6).toFixed(6).replace(/0+$/,"").replace(/\.$/,"")+"m"
  if(a>=1e3) return s+(a/1e3).toFixed(6).replace(/0+$/,"").replace(/\.$/,"")+"k"
  return s+q4(a).toFixed(4)
}

/* =========================================================
   WORDS
========================================================= */
const digitWords=["zero","one","two","three","four","five","six","seven","eight","nine"]
function intWords(n){
  if(n===0) return "zero"
  const u=[[1e9,"billion"],[1e6,"million"],[1e3,"thousand"]]
  let r=""
  for(const [v,w] of u){
    if(n>=v){ r+=Math.floor(n/v)+" "+w+" "; n%=v }
  }
  return (r+n).trim()
}
function words(){
  const v=q4(numberState.value).toFixed(4)
  const [i,d]=v.split(".")
  const sign=numberState.value<0?"minus ":""
  return sign+intWords(Math.abs(+i))+" point "+
    d.split("").map(x=>digitWords[x]).join(" ")
}

/* =========================================================
   RENDER
========================================================= */
function render(){
  document.getElementById("numeric").innerText = formatCompact(numberState.value)
  document.getElementById("words").innerText = words()
  const b=document.getElementById("ind-bgn")
  if(b) b.classList.toggle("active", false)
}

/* =========================================================
   KEY HANDLER
========================================================= */
document.querySelectorAll("button").forEach(b=>{
  b.onclick=()=>{
    const k=b.dataset.key
    if("0123456789".includes(k)) enterDigit(k)
    else if(k===".") enterDecimal()
    else if(k==="DEL") backspace()
    else if(k==="±") toggleSign()
    else if(["+","-","*","/"].includes(k)) pressOperator(k)
    else if(k==="=") pressEquals()
    else if(k==="CLR") backspace()
    else if(k==="CLR_ALL") clearAll()
    else if(k==="ENTER") setNumber(numberState.value)
    else if(k==="STO") store()
    else if(k==="RCL") recall()
    else if(k==="2ND") toggleSecond()
    else if(k==="LN") pressLN()
  }
})

render()
