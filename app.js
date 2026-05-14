// ----------------------------
// CONFIGURACIÓN SUPABASE
// ----------------------------
const SUPABASE_URL = "https://ncoieieeihooveochnbl.supabase.co"; // cambia esto
const SUPABASE_KEY = "sb_publishable_5YYIuLsxZXPayd0WRBzZWA_hmL7GKTi"; // cambia esto
const SUPABASE_TABLE = "lora_dht_readings";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ----------------------------
// VARIABLES GLOBALES
// ----------------------------
const tempCtx = document.getElementById("tempChart").getContext("2d");
const humCtx  = document.getElementById("humChart").getContext("2d");
const dataTableBody = document.querySelector("#dataTable tbody");

let tempChart = new Chart(tempCtx, {
    type:"line",
    data:{ labels:[], datasets:[
      { label:"TX1", data:[], borderColor:"red", fill:false, tension:0.2 },
      { label:"RX_SIM", data:[], borderColor:"blue", fill:false, tension:0.2 }
    ]},
    options:{ responsive:true, plugins:{legend:{position:"top"}}, scales:{y:{beginAtZero:true}} }
});

let humChart = new Chart(humCtx, {
    type:"line",
    data:{ labels:[], datasets:[
      { label:"TX1", data:[], borderColor:"red", fill:false, tension:0.2 },
      { label:"RX_SIM", data:[], borderColor:"blue", fill:false, tension:0.2 }
    ]},
    options:{ responsive:true, plugins:{legend:{position:"top"}}, scales:{y:{beginAtZero:true}} }
});

let latestCycleData = {};

// ----------------------------
// FUNCIONES AUXILIARES
// ----------------------------
function addDataToCharts(ciclo, tx1Temp, rxSimTemp, tx1Hum, rxSimHum){
    tempChart.data.labels.push(ciclo);
    tempChart.data.datasets[0].data.push(tx1Temp);
    tempChart.data.datasets[1].data.push(rxSimTemp);

    humChart.data.labels.push(ciclo);
    humChart.data.datasets[0].data.push(tx1Hum);
    humChart.data.datasets[1].data.push(rxSimHum);

    if(tempChart.data.labels.length>50){
        tempChart.data.labels.shift();
        tempChart.data.datasets.forEach(ds=>ds.data.shift());
        tempChart.update();
        humChart.data.labels.shift();
        humChart.data.datasets.forEach(ds=>ds.data.shift());
        humChart.update();
    } else {
        tempChart.update();
        humChart.update();
    }
}

function addRowToTable(row){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.cycle_id}</td>
      <td>${row.node_id}</td>
      <td>${row.temperature}</td>
      <td>${row.humidity}</td>
      <td>${row.data_type}</td>
      <td>${row.rssi ?? ""}</td>
      <td>${row.snr ?? ""}</td>
      <td>${new Date(row.created_at).toLocaleString()}</td>
    `;
    dataTableBody.appendChild(tr);
}

function exportTableToCSV(filename="data.csv"){
    let csv=[];
    const rows=document.querySelectorAll("table tr");
    rows.forEach(row=>{
        let cols=row.querySelectorAll("th, td");
        let data=[];
        cols.forEach(col=>data.push(col.innerText));
        csv.push(data.join(","));
    });
    const blob = new Blob([csv.join("\n")],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
    URL.revokeObjectURL(url);
}
document.getElementById("exportCSV").addEventListener("click", exportTableToCSV);

// ----------------------------
// CARGAR HISTÓRICO
// ----------------------------
async function loadHistoricalData(){
    const { data, error } = await supabase.from(SUPABASE_TABLE)
        .select("*").order("created_at",{ascending:true});
    if(error){ console.error(error); return; }

    data.forEach(row=>addRowToTable(row));

    const cycles=[...new Set(data.map(d=>d.cycle_id))].slice(-50);
    cycles.forEach(ciclo=>{
        const tx1 = data.find(d=>d.cycle_id==ciclo && d.node_id=="TX1");
        const rxSim = data.find(d=>d.cycle_id==ciclo && d.node_id=="RX_SIM");
        if(tx1 && rxSim) addDataToCharts(ciclo, tx1.temperature, rxSim.temperature, tx1.humidity, rxSim.humidity);
    });
}

// ----------------------------
// SUSCRIPCIÓN REALTIME
// ----------------------------
const myChannel = supabase.channel('table-db-changes')
  .on('postgres_changes', { event:'INSERT', schema:'public', table:SUPABASE_TABLE }, payload=>{
    console.log("Evento Realtime recibido:", payload.new);

    const row=payload.new;
    const ciclo=row.cycle_id;
    const nodo=row.node_id;

    if(!latestCycleData[ciclo]) latestCycleData[ciclo]={};
    latestCycleData[ciclo][nodo]=row;

    addRowToTable(row);

    const cicloData = latestCycleData[ciclo];
    if(cicloData.TX1 && cicloData.RX_SIM){
        addDataToCharts(
            ciclo,
            cicloData.TX1.temperature,
            cicloData.RX_SIM.temperature,
            cicloData.TX1.humidity,
            cicloData.RX_SIM.humidity
        );
    }
  })
  .subscribe();

// ----------------------------
// INICIO
// ----------------------------
loadHistoricalData();