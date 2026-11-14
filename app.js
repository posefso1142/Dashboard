const API_URL = "https://script.google.com/macros/s/AKfycbwAHn9p9fA4FSjl6YuPXgI1232NCSjVe6BbBewC05Et9_7ND_Obstgrv7q9uZaQQRq5/exec";

const chartInstances = new Map();

const dashboardMain = document.getElementById("dashboardMain");
const summaryStrip = document.getElementById("summaryStrip");
const totalPositionsEl = document.getElementById("totalPositions");
const totalVotesEl = document.getElementById("totalVotes");
const lastUpdatedEl = document.getElementById("lastUpdated");
const statusDotEl = document.getElementById("statusDot");
const refreshBtn = document.getElementById("refreshBtn");
const refreshIcon = document.getElementById("refreshIcon");

const ICONS = {
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>`,
  chevronDown: `<svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  inbox: `<svg class="icon-lg text-indigo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`
};

async function fetchElectionData() {
  refreshBtn.disabled = true;
  refreshIcon.classList.add("spin");

  try {
    const response = await fetch(`${API_URL}?t=${Date.now()}`, {
      method: "GET",
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`เซิร์ฟเวอร์ตอบกลับสถานะ ${response.status}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("ไม่สามารถอ่านข้อมูลได้ (ตรวจสอบการตั้งค่า Deploy ใน Apps Script ให้สิทธิ์เป็น 'ทุกคน / Anyone')");
    }

    if (data.error) throw new Error(data.error);

    statusDotEl.classList.remove("is-error");
    totalVotesEl.textContent = Number(data.totalVotes || 0).toLocaleString("th-TH");
    lastUpdatedEl.textContent = `อัปเดตล่าสุด: ${data.updatedAt || "เมื่อสักครู่"}`;

    const positions = data.positions || [];
    totalPositionsEl.textContent = positions.length;
    summaryStrip.hidden = positions.length === 0;

    renderDashboard(positions);
  } catch (err) {
    statusDotEl.classList.add("is-error");
    lastUpdatedEl.textContent = "เชื่อมต่อข้อมูลไม่สำเร็จ";
    summaryStrip.hidden = true;
    renderError(err.message);
  } finally {
    refreshBtn.disabled = false;
    refreshIcon.classList.remove("spin");
  }
}

function renderDashboard(positions) {
  chartInstances.forEach(chart => chart.destroy());
  chartInstances.clear();

  if (positions.length === 0) {
    dashboardMain.innerHTML = `
      <div class="state-box">
        ${ICONS.inbox}
        <h3>ยังไม่มีข้อมูลคะแนนโหวต</h3>
        <p>เมื่อมีผู้ตอบแบบสอบถามใน Google Forms คะแนนจะแสดงที่นี่โดยอัตโนมัติ</p>
      </div>
    `;
    return;
  }

  const cardsHtml = positions.map((pos, index) => {
    const posKey = pos.id || `pos_${index}`;
    const canvasId = `chart_${posKey}`;
    const drawerId = `drawer_${posKey}`;
    const hasCandidates = pos.candidates && pos.candidates.length > 0;
    const maxVotes = hasCandidates ? pos.candidates[0].votes : 0;
    const topCandidate = hasCandidates ? pos.candidates[0] : null;

    const candidatesHtml = (pos.candidates || []).map((cand, idx) => {
      const isLeader = maxVotes > 0 && cand.votes === maxVotes;
      return `
        <div class="candidate-item ${isLeader ? "is-leader" : ""}">
          <div class="candidate-top">
            <div class="candidate-left">
              <span class="rank-badge">${idx + 1}</span>
              <span class="candidate-name" title="${escapeHtml(cand.name)}">${escapeHtml(cand.name)}</span>
              ${isLeader ? `<span class="leader-pill">${ICONS.crown} นำ</span>` : ""}
            </div>
            <div class="candidate-right">
              <strong>${cand.votes}</strong> (${cand.percentage}%)
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${cand.percentage}%"></div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <section class="position-card">
        <div class="card-header">
          <div class="card-title-group">
            <div class="card-title-icon">${ICONS.trophy}</div>
            <h2>${escapeHtml(pos.title)}</h2>
          </div>
          <span class="vote-count-pill">${pos.totalPositionVotes || 0} โหวต</span>
        </div>

        ${topCandidate ? `
          <div class="leader-summary" title="อันดับ 1: ${escapeHtml(topCandidate.name)}">
            <div class="leader-summary-left">
              ${ICONS.crown}
              <span>นำ:</span>
              <span class="leader-summary-name">${escapeHtml(topCandidate.name)}</span>
            </div>
            <span class="leader-summary-score">${topCandidate.votes} คะแนน (${topCandidate.percentage}%)</span>
          </div>
        ` : ""}

        <div class="chart-wrapper">
          <canvas id="${canvasId}"></canvas>
        </div>

        ${hasCandidates ? `
          <button
            type="button"
            class="btn-toggle-details"
            aria-expanded="false"
            aria-controls="${drawerId}"
            data-target="${drawerId}"
            data-count="${pos.candidates.length}"
          >
            <span>ดูรายชื่อและคะแนนทั้งหมด (${pos.candidates.length} คน)</span>
            ${ICONS.chevronDown}
          </button>

          <div id="${drawerId}" class="candidate-drawer" hidden>
            <div class="candidate-list">
              ${candidatesHtml}
            </div>
          </div>
        ` : ""}
      </section>
    `;
  }).join("");

  dashboardMain.innerHTML = `<div class="positions-grid">${cardsHtml}</div>`;

  // ผูก Event ปุ่มกด "ดูรายชื่อและคะแนนทั้งหมด" ของแต่ละการ์ด
  document.querySelectorAll(".btn-toggle-details").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetEl = document.getElementById(btn.dataset.target);
      const isExpanded = btn.getAttribute("aria-expanded") === "true";
      const nextState = !isExpanded;

      btn.setAttribute("aria-expanded", String(nextState));
      targetEl.hidden = !nextState;

      const labelSpan = btn.querySelector("span");
      labelSpan.textContent = nextState
        ? "ซ่อนรายชื่อผู้สมัคร"
        : `ดูรายชื่อและคะแนนทั้งหมด (${btn.dataset.count} คน)`;
    });
  });

  // วาดแผนภูมิแท่ง
  positions.forEach((pos, index) => {
    const canvasId = `chart_${pos.id || `pos_${index}`}`;
    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl || !pos.candidates || pos.candidates.length === 0 || typeof Chart === "undefined") return;

    const maxVotes = pos.candidates[0].votes;
    const labels = pos.candidates.map(c => {
      const shortName = c.name.split(":")[0].trim();
      return shortName.length > 12 ? shortName.slice(0, 12) + "…" : shortName;
    });

    const fullNames = pos.candidates.map(c => c.name);
    const votesData = pos.candidates.map(c => c.votes);
    const barColors = pos.candidates.map(c =>
      maxVotes > 0 && c.votes === maxVotes ? "#f59e0b" : "#2563eb"
    );

    const chart = new Chart(canvasEl, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "คะแนนโหวต",
          data: votesData,
          backgroundColor: barColors,
          borderRadius: 6,
          maxBarThickness: 36
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0f172a",
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: (items) => fullNames[items[0].dataIndex],
              label: (ctx) => ` ได้รับ ${ctx.raw} คะแนน (${pos.candidates[ctx.dataIndex].percentage}%)`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#475569", font: { family: "'Noto Sans Thai', sans-serif", size: 11 } },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#64748b", stepSize: 1, precision: 0, font: { family: "'Noto Sans Thai', sans-serif", size: 11 } },
            grid: { color: "#e2e8f0" }
          }
        }
      }
    });

    chartInstances.set(canvasId, chart);
  });
}

function renderError(message) {
  dashboardMain.innerHTML = `
    <div class="state-box is-error">
      <div class="error-icon-wrap">${ICONS.alert}</div>
      <h3>ไม่สามารถโหลดข้อมูลคะแนนได้</h3>
      <p>${escapeHtml(message)}</p>
      <button type="button" class="btn btn-primary" onclick="fetchElectionData()">ลองเชื่อมต่ออีกครั้ง</button>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

refreshBtn.addEventListener("click", fetchElectionData);

fetchElectionData();
setInterval(fetchElectionData, 30000);