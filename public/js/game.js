const socket = io();
const params = new URLSearchParams(location.search);
const room = params.get("code");
const clientId = params.get("clientId") || localStorage.getItem("clientId");
const playerName = sessionStorage.getItem("playerName") || "ผู้เล่นไร้นาม";
let privateLogs = []; // เอาไว้เก็บ Log จั่วไพ่ของเราเอง
let latestLocalLog = null;
let localTimeLeft = 0;
let localTimerInterval = null;
let lastCardCount = 0;
let lastState = null;
// ตรวจสอบข้อมูลเบื้องต้น
if (!room || !clientId) {
    alert("ข้อมูลไม่ครบถ้วน กำลังกลับหน้าหลัก...");
    location.href = "/";
}
// ส่งสัญญาณเข้าร่วมห้อง
socket.emit("joinRoom", { code: room, name: playerName, clientId: clientId });
let selectedCardsIdx = [];
let myLocalHand = []; // เก็บชื่อการ์ดตามลำดับที่เราจัดไว้
/* ===== DOM ELEMENTS ===== */
const roomCodeEl = document.getElementById("roomCode");
const playersEl = document.getElementById("players");
const resetBtn = document.getElementById("resetBtn");
const drawBtn = document.getElementById("draw");
const handEl = document.getElementById("hand");
const deckEl = document.getElementById("deckCount");
const logEl = document.getElementById("gameLog");
const elements = {
    confirmPlay: document.getElementById("confirmPlay"),
    drawBtn: document.getElementById("draw"),
    nopeBtn: document.getElementById("nopeBtn")
};
/* ===== MAIN STATE LISTENER ===== */
socket.on("drawSuccess", (data) => {
    console.log("ได้รับ Event drawSuccess:", data.card); // ตรวจสอบใน F12 Console
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ":" + 
                 now.getMinutes().toString().padStart(2, '0') + ":" + 
                 now.getSeconds().toString().padStart(2, '0');
   latestLocalLog = {
        text: `<strong style="color:#3498db;">[จั่วไพ่]</strong> คุณได้รับ: <strong>${data.card}</strong>`,
        time: time,
        kind: 'private'
    }
    privateLogs.push({
        text: `<strong style="color:#3498db;">[จั่วไพ่]</strong> คุณได้รับ: <strong>${data.card}</strong>`,
        time: time,
        kind: 'private' // กำหนดประเภทให้รู้ว่าเป็นสีฟ้า
    });
    
    const logEl = document.getElementById("gameLog");
    if (logEl) {
        const div = document.createElement("div");
        div.className = "log log-private";
        div.style.cssText = "color: #3498db; background: rgba(52, 152, 219, 0.1); padding: 5px; border-radius: 5px; margin-top: 5px;";
        div.innerHTML = `<strong>[จั่วสำเร็จ]</strong> คุณได้รับ: ${data.card}`;
        
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
    }
});
socket.on("state", (roomState) => {
    if (!roomState) return;
    console.log("State Action:", roomState.pendingAction);

    lastState = roomState;
    const me = roomState.players.find(p => p.clientId === clientId);
    // 🚩 1. ประกาศตัวแปรที่จำเป็นต้องใช้ก่อน (Initialization)
    const isHost = roomState.hostClientId === clientId; 
    const isMyTurn = roomState.players[roomState.turn]?.clientId === clientId;

    // 1. จัดการข้อมูลไพ่บนมือและการ Sort
    if (me && me.hand) {
        if (me.hand.length > lastCardCount && roomState.players[roomState.turn].clientId === clientId) {
            addLocalLog(`จั่วไพ่ใหม่สำเร็จ (มีไพ่ทั้งหมด ${me.hand.length} ใบ)`, 'info');
        }
        lastCardCount = me.hand.length;
        me.hand.sort((a, b) => a.localeCompare(b, 'th'));
    }

    // 2. แสดงข้อมูลห้องและรายชื่อผู้เล่น
    roomCodeEl.innerText = "รหัสห้อง: " + (roomState.code || room);
    const playersList = document.getElementById("players");
    if (playersList) {
        playersList.innerHTML = "";

        roomState.players.forEach((p, index) => {
    const isCurrentTurn = roomState.turn === index;
    const playerDiv = document.createElement("div");
    playerDiv.className = `player-item ${isCurrentTurn ? 'active-turn' : ''} ${!p.alive ? 'player-dead' : ''}`;
    
    // 🚩 ตรวจสอบสิทธิ์ Host (เพิ่มตรงนี้เพื่อให้มีปุ่มเตะ)
    const showKickBtn = isHost && p.clientId !== clientId;

    const cardCount = p.hand ? p.hand.length : 0;
    playerDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>
                ${isCurrentTurn ? "👉 " : ""}
                <strong>${p.name}</strong> ${p.clientId === clientId ? "(คุณ)" : ""}
                ${p.clientId === roomState.hostClientId ? "👑" : ""}
            </span>
            <span>
                ${p.alive ? `<span class="badge-cards">🂠 ${cardCount} ใบ</span>` : `<span style="color: red;">💀</span>`}
                ${showKickBtn ? `<button onclick="kickPlayer('${p.clientId}')" style="margin-left:8px; background:#ff4757; color:white; border:none; padding:2px 5px; cursor:pointer; border-radius:3px;">เตะ</button>` : ""}
            </span>
        </div>`;
    playersList.appendChild(playerDiv);
});
    }
    if (logEl && roomState.logs) {
        logEl.innerHTML = "";
        const serverLogs = roomState.logs.slice(-9);
        serverLogs.forEach(l => {
            const div = document.createElement("div");
            const logType = l.kind || 'system';
            div.className = `log log-${logType}`;
            let displayText = l.text;
            if (displayText.includes("แมว") && (displayText.includes("x2") || displayText.includes("x3"))) {
                displayText = displayText.replace(/แมว[ก-ฮa-zA-Z]*\s*x2/g, "Combo แมว 2 ใบ").replace(/แมว[ก-ฮa-zA-Z]*\s*x3/g, "Combo แมว 3 ใบ");
            }
            div.innerHTML = `<small style="color:gray;">${l.time || ''}</small> ${displayText}`;
            logEl.appendChild(div);
        });

        if (latestLocalLog) {
            const pDiv = document.createElement("div");
            pDiv.className = "log log-private";
            pDiv.style.cssText = "background: rgba(52, 152, 219, 0.1); border-left: 3px solid #3498db; padding: 2px 8px; margin-top: 2px; border-radius: 4px;";
            pDiv.innerHTML = `<small style="color:gray;">${latestLocalLog.time}</small> ${latestLocalLog.text}`;
            logEl.appendChild(pDiv);
        }
        logEl.scrollTop = logEl.scrollHeight;
    }
    if (resetBtn) {
        if (isHost) {
            resetBtn.classList.remove("hidden"); // แสดงถ้าเป็น Host
            resetBtn.onclick = () => {
                if (confirm("ต้องการล้างเกมและเริ่มใหม่ใช่หรือไม่? (ทุกคนจะถูกรีเซ็ตไพ่)")) {
                    socket.emit("resetGame", roomState.code);
                }
            };
        } else {
            resetBtn.classList.add("hidden"); // ซ่อนถ้าไม่ใช่ Host
        }
    }
    const startBtn = document.getElementById("startGame");
    if (startBtn) {
        // เงื่อนไข: เป็น Host และเกมยังไม่เริ่ม
        if (isHost && !roomState.started) {
            startBtn.classList.remove("hidden");
            startBtn.style.display = "block"; // บังคับแสดงผลกรณี CSS ขัดกัน
        } else {
            startBtn.classList.add("hidden");
            startBtn.style.display = "none";
    }
    
    // 5. จัดการปุ่มจั่วไพ่
    const drawBtn = document.getElementById("draw");
    if (drawBtn) {
        if (!roomState.started) {
            drawBtn.disabled = true;
            drawBtn.innerText = "รอเริ่มเกม...";
        } else {
            drawBtn.disabled = !isMyTurn || !!roomState.pendingAction || !!roomState.pendingBomb;
            if (isMyTurn) {
                if (roomState.attackStack > 1) {
                    drawBtn.innerText = `🔥 จั่วไพ่ (${roomState.attackStack} ครั้ง)`;
                    drawBtn.style.background = "#d63031";
                    drawBtn.classList.add("pulse-animation");
                } else {
                    drawBtn.innerText = "🃏 จั่วไพ่";
                    drawBtn.style.background = "";
                    drawBtn.classList.remove("pulse-animation");
                }
            } else {
                const activePlayerName = roomState.players[roomState.turn].name;
                drawBtn.innerText = `ตาของ ${activePlayerName}`;
                drawBtn.style.background = "";
            }
        }
    }
    // 6. อัปเดตกองไพ่
    const deckEl = document.getElementById("deckCount");
    if (deckEl) deckEl.innerText = `🂠 กองไพ่เหลือ ${roomState.deck?.length || 0} ใบ`;
    // 7. วาดไพ่บนมือ
    renderHand(roomState);
    validateSelection(roomState);
    // 8. ===== NOPE / TIMER LOGIC (จุดที่มีปัญหา) =====
    const action = roomState.pendingAction;
    const nopeOverlay = document.getElementById("nopeOverlay");
    const nopeBtn = document.getElementById("nopeBtn");
    const nopeTitle = document.getElementById("nopeTitle");
    // ล้าง Interval เดิมก่อนเสมอ
    if (localTimerInterval) clearInterval(localTimerInterval);
    if (action) {
        // --- 8.1 การแสดงข้อความบน Overlay ---
        const actingPlayer = roomState.players.find(p => p.clientId === action.playerClientId);
        const playerName = actingPlayer ? actingPlayer.name : "ใครบางคน";
        let displayCardName = action.card;
        const reqCard = action.requestedCard;

        if (displayCardName === "COMBO_2" || displayCardName.startsWith("แมว")) {
            displayCardName = action.useCount === 3 ? `Combo 3 ใบ (ขโมย: ${reqCard || "???"})` : "Combo 2 ใบ (สุ่มขโมย)";
        } else if (displayCardName === "COMBO_5") {
            displayCardName = `Combo 5 ใบ (กู้ชีพ: ${reqCard || "???"})`;
        }

        if (action.noped) {
            nopeTitle.innerHTML = `🚫 การ์ดของ <span style="color:#ffeaa7">${playerName}</span><br>ถูกระงับด้วย "ม่าย"!`;
        } else {
            nopeTitle.innerHTML = `🚨 <span style="color:#ffeaa7">${playerName}</span><br>กำลังใช้ "${displayCardName}"`;
        }

        // --- 8.2 การจัดการตัวนับเวลา (Server Time) ---
        if (action.remaining > 0) {
            nopeOverlay.classList.remove("hidden");
            localTimeLeft = action.remaining;
            
            localTimerInterval = setInterval(() => {
                localTimeLeft -= 100;
                if (localTimeLeft <= 0) {
                    localTimeLeft = 0;
                    clearInterval(localTimerInterval);
                    nopeOverlay.classList.add("hidden");
                }
                renderTimerUI(localTimeLeft, action.duration || 5000);
            }, 100);
            renderTimerUI(localTimeLeft, action.duration || 5000);
        } else {
            nopeOverlay.classList.add("hidden");
        }
        // --- 8.3 การแสดงปุ่ม Nope ---
        const hasNope = me?.hand.includes("ม่าย");
        if (hasNope && me.alive) {
            nopeBtn.classList.remove("hidden");
            nopeBtn.disabled = false;
            nopeBtn.innerText = "❌ ม่าย (NOPE)";
        } else {
            nopeBtn.classList.add("hidden");
        }
    } else {
        // ถ้าไม่มี pendingAction เลย ให้ซ่อนทั้งหมด
        nopeOverlay.classList.add("hidden");
        nopeBtn.classList.add("hidden");
    }
}
});
// 1. เมื่อจั่วเจอระเบิด และต้องกด "แก้ระเบิด"
/* ===== 2. BOMB LOGIC (แยกออกมาข้างนอก) ===== */
socket.on("showDefusePrompt", () => {
    if (document.getElementById("defuseModal")) return; // กันเด้งซ้ำ
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "defuseModal";
    overlay.innerHTML = `
        <div class="bomb-modal">
            <h2>💣 เจอระเบิด!</h2>
            <button class="defuse-btn" onclick="useDefuse()">ใช้การ์ดแก้ระเบิด</button>
        </div>`;
    document.body.appendChild(overlay);
});
window.useDefuse = () => {
    socket.emit("defuseBomb", room);
    const modal = document.getElementById("defuseModal");
    if (modal) modal.remove();
};
socket.on("chooseBombPosition", (maxPosition) => {
    let pos = prompt(`🛡️ แก้สำเร็จ! วางคืนตรงไหน? (0-${maxPosition})`, "0");
    socket.emit("placeBomb", { code: room, position: parseInt(pos) || 0 });
});
/* ===== ดูอนาคต (See the Future) ===== */
socket.on("futureCards", (cards) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "futureModal";
    
    let cardsHtml = cards.map(c => `
        <div style="display:inline-block; margin:10px;">
            <img src="/assets/cards/${c}.png" style="width:80px; border-radius:8px;">
            <p>${c}</p>
        </div>
    `).join("");

    overlay.innerHTML = `
        <div class="bomb-modal" style="max-width:400px;">
            <h2>🔮 ดูอนาคต</h2>
            <div style="margin-bottom:20px;">${cardsHtml}</div>
            <button class="defuse-btn" onclick="this.parentElement.parentElement.remove()">รับทราบ</button>
        </div>
    `;
    document.body.appendChild(overlay);
});
/* ===== เปลี่ยนอนาคต (Alter the Future) ===== */
let tempFutureOrder = [];

socket.on("reorderFuture", (cards) => {
    tempFutureOrder = [...cards];
    showAlterModal();
});
/* ===== GAME OVER LOGIC ===== */
socket.on("gameOver", (data) => {
    // สร้าง Overlay แจ้งผู้ชนะ
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "gameOverModal";
    overlay.innerHTML = `
        <div class="bomb-modal" style="border: 4px solid #f1c40f;">
            <h1 style="font-size: 50px;">🏆</h1>
            <h2 style="color: #f1c40f; margin-top: 0;">เราได้ผู้ชนะแล้ว!</h2>
            <p style="font-size: 20px;">🎉 <strong>${data.winnerName}</strong> เป็นผู้รอดชีวิตคนสุดท้าย</p>
            <button class="defuse-btn" onclick="location.reload()" style="background: #27ae60;">กลับหน้าล็อบบี้</button>
        </div>
    `;
    document.body.appendChild(overlay);

    // ปิดการใช้งานปุ่มทั้งหมดในหน้าจอ
    document.getElementById("draw").disabled = true;
    document.getElementById("confirmPlay").classList.add("hidden");
});
function showAlterModal() {
    const existing = document.getElementById("alterModal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "alterModal";

    const cardCount = tempFutureOrder.length;

    // สร้าง HTML สำหรับแต่ละการ์ด
    let cardsHtml = tempFutureOrder.map((c, i) => `
        <div style="
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            background: #333; 
            margin-bottom: 8px; 
            padding: 10px; 
            border-radius: 10px; 
            border: 1px solid #555;
            ${i === 0 ? 'border-left: 5px solid #2ed573;' : ''} /* เน้นใบแรกที่จะจั่ว */
        ">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="font-weight: bold; color: ${i === 0 ? '#2ed573' : '#aaa'}; width: 20px;">
                    ${i + 1}.
                </div>
                <img src="/assets/cards/${c}.png" 
                     onerror="this.src='/assets/cards/default.png'"
                     style="height: 60px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">
                <div>
                    <div style="font-weight: bold;">${c}</div>
                    ${i === 0 ? '<div style="font-size: 10px; color: #2ed573;">(จั่วใบแรก)</div>' : ''}
                </div>
            </div>

            <div style="display: flex; gap: 5px;">
                <button onclick="window.moveFuture(${i}, -1)" 
                    style="
                        background: #444; color: white; border: none; 
                        padding: 8px 12px; border-radius: 5px; cursor: pointer;
                        opacity: ${i === 0 ? '0.3' : '1'};
                    " 
                    ${i === 0 ? 'disabled' : ''}>
                    ⬆️
                </button>
                <button onclick="window.moveFuture(${i}, 1)" 
                    style="
                        background: #444; color: white; border: none; 
                        padding: 8px 12px; border-radius: 5px; cursor: pointer;
                        opacity: ${i === cardCount - 1 ? '0.3' : '1'};
                    " 
                    ${i === cardCount - 1 ? 'disabled' : ''}>
                    ⬇️
                </button>
            </div>
        </div>
    `).join("");

    overlay.innerHTML = `
        <div class="bomb-modal" style="width: 90%; max-width: 450px; text-align: left;">
            <h2 style="text-align: center; margin-bottom: 5px;">🌀 เปลี่ยนอนาคต</h2>
            <p style="text-align: center; color: #bbb; font-size: 0.9rem; margin-bottom: 15px;">
                เรียงลำดับไพ่ <strong>บนสุด</strong> คือใบที่จะถูกจั่วเป็นใบแรก
            </p>
            
            <div style="max-height: 60vh; overflow-y: auto; padding-right: 5px;">
                ${cardsHtml}
            </div>

            <div style="margin-top: 20px; text-align: center;">
                <button class="defuse-btn" onclick="window.submitAlter()" style="width: 100%;">
                    ✅ ยืนยันลำดับนี้
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

// ฟังก์ชันสลับตำแหน่งใน Modal
window.moveFuture = (index, direction) => {
    const target = index + direction;
    
    // ตรวจสอบว่าเป้าหมายที่จะสลับไปนั้น มีตัวตนอยู่จริงหรือไม่
    if (target < 0 || target >= tempFutureOrder.length) return;

    // สลับตำแหน่งเฉพาะการ์ดที่มีอยู่จริง
    const temp = tempFutureOrder[index];
    tempFutureOrder[index] = tempFutureOrder[target];
    tempFutureOrder[target] = temp;
    
    showAlterModal(); // วาดหน้าต่างใหม่
};
window.submitAlter = () => {
    socket.emit("submitFutureOrder", { code: room, order: tempFutureOrder });
    const modal = document.getElementById("alterModal");
    if (modal) modal.remove();
};

/* ===== FUNCTIONS ===== */
function renderHand(roomState) {
    const me = roomState.players.find(p => p.clientId === clientId);
    if (!me || !me.alive) {
        handEl.innerHTML = me ? "<p style='color:red;'>💀 คุณตายแล้ว</p>" : "";
        return;
    }

    handEl.innerHTML = "";
    me.hand.forEach((card, index) => {
        const btn = document.createElement("button");
        btn.className = "card-button";
        btn.style.zIndex = index;
        if (selectedCardsIdx.includes(index)) btn.classList.add("selected");
        
        btn.innerHTML = `
            <img src="/assets/cards/${card}.png" onerror="this.src='/assets/cards/default.png'">
            <div style="font-size:10px; margin-top:4px;">${card}</div>
        `;
        
        btn.onclick = () => {
            const sIdx = selectedCardsIdx.indexOf(index);
            if (sIdx > -1) selectedCardsIdx.splice(sIdx, 1);
            else selectedCardsIdx.push(index);
            renderHand(roomState);
            validateSelection(roomState);
        };
        handEl.appendChild(btn);
    });
}
// ฟังก์ชันส่งคำสั่งไป Server (ต้องมี window. นำหน้าเพื่อให้ HTML เรียกได้)
window.showDiscardPicker = (pile, selectedCardsIdx) => {
    const currentPile = lastState ? lastState.discardPile : pile;
    if (!currentPile || currentPile.length === 0) return alert("กองทิ้งว่างเปล่า");

    // เก็บรายการไพ่ที่จะใช้ไว้ในตัวแปร global ชั่วคราว เพื่อให้ confirmFiveCombo เข้าถึงได้ง่าย
    const myHand = lastState.players.find(p => p.clientId === clientId).hand;
    window.tempCardsToUse = selectedCardsIdx.map(idx => myHand[idx]);

    const oldModal = document.getElementById("discardPickerModal");
    if (oldModal) oldModal.remove();

    const modal = document.createElement("div");
    modal.id = "discardPickerModal";
    modal.className = "modal-overlay";
    Object.assign(modal.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.85)', zIndex: '10000',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    const uniqueCards = [...new Set(currentPile)];
    modal.innerHTML = `
        <div class="modal-content" style="background:#222; padding:20px; border-radius:15px; width:90%; max-width:400px; max-height:80vh; display:flex; flex-direction:column;">
            <h3 style="margin:0 0 15px 0; color:#2ed573; text-align:center;">เลือกการ์ด 1 ใบจากกองทิ้ง</h3>
            
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; overflow-y:auto; padding:10px; flex-grow:1; background:#111; border-radius:10px;">
                ${uniqueCards.map(cardName => `
                    <div style="cursor:pointer; text-align:center; background:#333; padding:5px; border-radius:8px; border:1px solid #444;" 
                         onclick="window.confirmFiveCombo('${cardName}')">
                        <img src="/assets/cards/${cardName}.png" 
                             style="width:100%; aspect-ratio:2/3; object-fit:contain; border-radius:5px; pointer-events:none;"
                             onerror="this.src='/assets/cards/default.png'">
                        <div style="font-size:10px; color:white; margin-top:5px; pointer-events:none;">
                            ${cardName}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <button onclick="this.closest('.modal-overlay').remove()" 
                    style="margin-top:15px; padding:12px; background:#ff4757; color:white; border:none; border-radius:8px; cursor:pointer;">
                ยกเลิก
            </button>
        </div>
    `;
    document.body.appendChild(modal);
};
// ฟังก์ชันที่คุณส่งมา (อัปเดตให้ลบ Modal)
window.confirmFiveCombo = (requestedCard) => {
    // ดึงค่าไพ่ 5 ใบที่เราเลือกไว้จากตัวแปรชั่วคราว
    const cards = window.tempCardsToUse;

    if (!cards || cards.length !== 5) {
        alert("ข้อมูลการ์ดไม่ถูกต้อง");
        return;
    }

    // ส่งข้อมูลไป Server
    socket.emit("playFiveCombo", { 
        code: room, 
        cards: cards, 
        requestedCard: requestedCard 
    });

    // ปิด Modal
    const modal = document.getElementById("discardPickerModal");
    if (modal) modal.remove();
    
    // ล้างสถานะการเลือกไพ่ในมือ
    selectedCardsIdx = [];
    window.tempCardsToUse = null;
    renderHand(lastState);
};
/* ===== ACTION HANDLERS ===== */
// ประกาศตัวแปรให้ชัดเจนก่อนใช้งาน
const confirmPlay = document.getElementById("confirmPlay")

// 1. ตรวจสอบการเลือกไพ่ (ปุ่มจะปรากฏขึ้นเมื่อเงื่อนไขถูกต้อง)
function validateSelection(roomState) {
    const btn = elements.confirmPlay; 
    if (!btn || !roomState) return;

    const me = roomState.players.find(p => p.clientId === clientId);
    if (!me || !me.alive) {
        btn.classList.add("hidden");
        return;
    }

    const isMyTurn = roomState.players[roomState.turn]?.clientId === clientId;
    const selectedCards = selectedCardsIdx.map(idx => me.hand[idx]);
    const count = selectedCards.length;

    let canPlay = false;

    // --- กรณีเล่นในตาตัวเอง ---
    if (isMyTurn && !roomState.pendingAction) {
        // Combo 2 ใบ
        if (count === 2) {
            const hasWild = selectedCards.includes("แมวแหล");
            const cats = selectedCards.filter(c => c.startsWith("แมว"));
            if (cats.length === 2) {
                if (hasWild) canPlay = true;
                else if (selectedCards[0] === selectedCards[1]) canPlay = true;
            }
        } 
        // Combo 3 ใบ
        else if (count === 3) {
            const cats = selectedCards.filter(c => c.startsWith("แมว"));
            if (cats.length === 3) {
                const normalCats = selectedCards.filter(c => c !== "แมวแหล");
                const allSame = normalCats.length === 0 || normalCats.every(c => c === normalCats[0]);
                if (allSame) canPlay = true;
            }
        }
        // Combo 5 ใบ (ต้องไม่ซ้ำกัน)
        else if (count === 5) {
            const uniqueCount = new Set(selectedCards).size;
            if (uniqueCount === 5) canPlay = true;
        }
        // การ์ดทั่วไปใบเดียว (ยกเว้น ม่าย และ แมว)
        else if (count === 1) {
            const card = selectedCards[0];
            const isNormalCard = !card.startsWith("แมว") && card !== "ม่าย" && card !== "แก้ระเบิด";
            if (isNormalCard) canPlay = true;
        }
    } 
    
    // --- กรณีเล่นนอกตา (การ์ด ม่าย) ---
    // ต้องมี Action ค้างอยู่ และเลือกไพ่ "ม่าย" เพียงใบเดียว
    if (count === 1 && selectedCards[0] === "ม่าย" && roomState.pendingAction) {
        // เช็คว่าเป็นคนใช้ Action นั้นเองหรือไม่ (ห้าม Nope ตัวเอง)
        if (roomState.pendingAction.playerClientId !== clientId) {
            canPlay = true;
        }
    }

    // แสดงผลปุ่ม
    if (canPlay) {
        btn.classList.remove("hidden");
    } else {
        btn.classList.add("hidden");
    }
}
// 2. เมื่อกดปุ่มยืนยัน
elements.confirmPlay.onclick = () => {
    if (!lastState) return;
    const me = lastState.players.find(p => p.clientId === clientId);
    const selectedCards = selectedCardsIdx.map(idx => me.hand[idx]);
    
    if (selectedCards.length === 0) return;

    const cardName = selectedCards[0];
    const count = selectedCards.length;

    // ส่งข้อมูลตามประเภท Combo
    if (count === 2) {
        window.openTargetPicker(2, selectedCardsIdx); 
    } else if (count === 3) {
        window.openTargetPicker(3, selectedCardsIdx);
    } else if (count === 5) {
        window.showDiscardPicker(lastState.discardPile, selectedCardsIdx);
    } else {
        // กรณีเล่นใบเดียว (เช่น ข้าม, โจมตี, ม่าย)
        socket.emit("playCard", { 
            code: room, 
            card: cardName, 
            useCount: 1 
        });
    }

    // ล้างสถานะหลังกด
    selectedCardsIdx = [];
    elements.confirmPlay.classList.add("hidden");
    renderHand(lastState);
};
/* ===== ฟังก์ชัน Global สำหรับปุ่มใน Modal ===== */
window.openTargetPicker = (useCount, selectedCardsIdx) => {
    const opponents = lastState.players.filter(p => p.clientId !== clientId && p.alive);

    if (opponents.length === 0) {
        alert("ไม่มีเพื่อนให้ขโมยเลย!");
        return;
    }

    const oldModal = document.getElementById("targetPickerModal");
    if (oldModal) oldModal.remove();

    const modal = document.createElement("div");
    modal.id = "targetPickerModal";
    modal.className = "modal-overlay";

    modal.innerHTML = `
        <div class="modal-content">
            <h3 style="margin:0 0 15px 0; color:#ffa502; text-align:center;">
                ${useCount === 2 ? 'เลือกเป้าหมายเพื่อสุ่มขโมย' : 'เลือกเป้าหมายเพื่อระบุชื่อขโมย'}
            </h3>
            <div class="picker-grid-small">
                ${opponents.map(opp => `
                    <div class="target-item" onclick="confirmSteal('${opp.clientId}', ${useCount}, ${JSON.stringify(selectedCardsIdx)})">
                        <div class="target-avatar">👤</div>
                        <div class="target-name">${opp.name}</div>
                        <div class="target-cards">ถือไพ่ ${opp.hand.length} ใบ</div>
                    </div>
                `).join('')}
            </div>
            <button onclick="this.closest('.modal-overlay').remove()" class="cancel-btn">ยกเลิก</button>
        </div>
    `;
    document.body.appendChild(modal);
};
window.confirmSteal = (targetClientId, useCount, selectedCardsIdx) => {
    // 1. ปิด Modal ทันทีป้องกันการกดย้ำ
    const modal = document.getElementById("targetPickerModal");
    if (modal) modal.remove();

    const me = lastState.players.find(p => p.clientId === clientId);
    // แปลง Index เป็นรายชื่อการ์ดจริง
    const cardsUsed = selectedCardsIdx.map(idx => me.hand[idx]);
    const firstCardName = cardsUsed[0];
    let mainCard = cardsUsed.find(c => c !== "แมวแหล");
    
    // ถ้าเลือกแมวแหลทั้งคู่ (กรณีหายาก) ให้ใช้แมวแหลเป็นชื่อหลัก
    if (!mainCard) mainCard = "แมวแหล";

    if (useCount === 3) {
        // ถ้าใช้ 3 ใบ: ไปที่ Modal เลือกชื่อการ์ดต่อ
        window.openCardTypePicker(targetClientId, cardsUsed);
    } else {
        // ถ้าใช้ 2 ใบ: เปลี่ยนจาก playAction เป็น playCard ให้เหมือนจุดอื่นๆ
        socket.emit("playCard", {
            code: room,
            card: mainCard, // ส่งชื่อการ์ดใบแรกเป็นตัวแทนกลุ่ม
            targetClientId: targetClientId,
            useCount: 2,         // ระบุให้ Server รู้ว่าเป็น Combo 2 ใบ
            selectedIndices: selectedCardsIdx // ส่ง Index ไปด้วยเพื่อให้ Server ลบไพ่ถูกใบ
        });
        
        // ล้างสถานะการเลือกหน้าจอ
        clearSelection();
    }
};

function clearSelection() {
    window.selectedCardsIdx = [];
    renderHand(lastState);
}
// ค้นหาส่วนที่ใช้สร้าง UI รายชื่อผู้เล่น
function updatePlayersUI(roomState) {
    const playersDiv = document.getElementById("players");
    playersDiv.innerHTML = ""; // ล้างข้อมูลเก่า

    roomState.players.forEach((p, index) => {
        const isCurrentTurn = roomState.turn === index;
        const pEl = document.createElement("div");
        
        // กำหนด Class สำหรับคนที่เป็นตาปัจจุบัน และคนที่ตายแล้ว
        pEl.className = `player-card ${isCurrentTurn ? 'active' : ''} ${!p.alive ? 'dead' : ''}`;
        
        // 🚩 เพิ่มการแสดงจำนวนการ์ดตรงนี้
        pEl.innerHTML = `
            <div class="player-info">
                <span class="player-name">${p.name} ${p.clientId === clientId ? "(คุณ)" : ""}</span>
                <div class="player-status">
                    ${p.alive 
                        ? `<span class="card-count">🂠 ${p.hand.length} ใบ</span>` 
                        : '<span class="status-dead">☠️ ออกจากเกม</span>'}
                </div>
            </div>
            ${isCurrentTurn && p.alive ? '<div class="turn-indicator">กำลังเล่น...</div>' : ''}
        `;
        playersDiv.appendChild(pEl);
    });
}
// แก้ปัญหา ReferenceError โดยการผูกฟังก์ชันเข้ากับ window
window.confirmPlayWithTarget = (card, targetId, useCount) => {
    socket.emit("playCard", { 
        code: room, 
        card: card, 
        targetClientId: targetId, 
        useCount: useCount 
    });
    // ปิด Modal เมื่อส่งคำสั่งเสร็จ
    const modal = document.getElementById("targetModal");
    if (modal) modal.remove();
    // ล้างสถานะการเลือกไพ่บนมือ
    selectedCardsIdx = [];
    renderHand(lastState);
};
window.openCardTypePicker = (targetClientId, cardsUsed) => {
    // 1. ปิด Modal อื่นๆ ที่อาจค้างอยู่
   const oldTargetModal = document.getElementById("targetPickerModal");
    if (oldTargetModal) oldTargetModal.remove();

    const oldNameModal = document.getElementById("cardNamePickerModal");
    if (oldNameModal) oldNameModal.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "cardNamePickerModal";

    // รายชื่อการ์ดที่สามารถระบุชื่อเพื่อขโมยได้
    const ALL_CARDS = ["ข้าม", "ม่าย", "โจมตี", "สับไพ่", "ดูอนาคต", "จั่วจากใต้กอง", "เปลี่ยนอนาคต", "แก้ระเบิด"];

    // เตรียมการ์ดแมวที่จะส่ง (เอาเฉพาะชื่อใบเดียวเพื่อเป็น ID ของการ์ดกลุ่มนี้)
    const catCardName = cardsUsed[0];

    let cardsHtml = ALL_CARDS.map(c => `
        <div class="card-item-picker" onclick="window.executeThreeCombo('${catCardName}', '${targetClientId}', '${c}')">
           <img src="/assets/cards/${c}.png" 
     style="width: 70px; height: 100px; object-fit: cover; border-radius: 5px; display: block; margin: 0 auto;"
     onerror="this.src='/assets/cards/default.png'">
        </div>
    `).join("");

    overlay.innerHTML = `
        <div class="bomb-modal" style="width: 80%; max-width: 400px;">
            <h3>👑 ระบุชื่อการ์ดที่ต้องการขโมย</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top:15px;">
                ${cardsHtml}
            </div>
            <button class="cancel-btn" style="margin-top:15px;" onclick="this.parentElement.parentElement.remove()">ยกเลิก</button>
        </div>
    `;
    document.body.appendChild(overlay);
};
window.executeThreeCombo = (cardName, targetId, reqCard) => {
    // ส่งข้อมูลไปที่ Server
    socket.emit("playCard", { 
        code: room, 
        card: cardName,        // ชื่อการ์ดแมวที่ใช้ (เช่น แมวสีชมพู)
        targetClientId: targetId, 
        useCount: 3,           // ระบุว่าเป็น Combo 3 ใบ
        requestedCard: reqCard // ชื่อการ์ดที่ระบุขโมย (เช่น ข้าม)
    });

    // ปิด Modal หลังส่งเสร็จ
    const modal = document.getElementById("cardNamePickerModal");
    if (modal) modal.remove();

    // ล้างสถานะการเลือกไพ่ในมือ
    if (typeof clearSelection === "function") {
        clearSelection();
    }
};
// ปุ่มเริ่มเกม และ ปุ่มจั่ว (ตรวจสอบให้แน่ใจว่าวางไว้นอก socket.on)
document.getElementById("startGame").onclick = () => socket.emit("startGame", room);
document.getElementById("draw").onclick = () => socket.emit("drawCard", room);
document.getElementById("nopeBtn").onclick = () => {
    // ตรวจสอบว่ามีห้อง (room) และอยู่ในช่วง pendingAction หรือไม่
    if (room && lastState && lastState.pendingAction) {
        socket.emit("playNope", room);
    }
};
function addLocalLog(message, kind = 'info') {
    if (!logEl) return;
    
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + 
                    now.getMinutes().toString().padStart(2, '0');
    const div = document.createElement("div");
    // ใช้ class 'log-private' เพื่อแต่งสีให้ต่างจาก log กลาง
    div.className = `log log-${kind} log-private`; 
    div.innerHTML = `<small style="color:gray;">${timeStr}</small> <span style="color:#74b9ff;">[เฉพาะคุณ]</span> ${message}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
}
function addPrivateLog(cardName) {
    const logEl = document.getElementById("logEl") || document.getElementById("gameLog");
    if (!logEl) return;
    const div = document.createElement("div");
    // ใช้ Class 'log-system' หรือสร้าง Class ใหม่ชื่อ 'log-private'
    div.className = "log log-private"; 
   
    // ใส่เนื้อหา Log
    div.innerHTML = `
        <small style="color:#aaa;">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small> 
        <span style="color:#74b9ff; font-weight:bold;"> [จั่วไพ่]</span> 
        คุณได้รับ : <strong>${cardName}</strong>
    `;
    logEl.appendChild(div);  
    // สั่งให้ Log เลื่อนลงไปล่างสุดเสมอ
    logEl.scrollTop = logEl.scrollHeight;
}
// ฟังก์ชันสำหรับวาดหลอดเวลาและตัวเลขวินาที
function renderTimerUI(timeLeft, totalDuration) {
    const timerNumber = document.getElementById("timerNumber");
    const timerBar = document.getElementById("timerBar");
    if (!timerNumber || !timerBar) return; // กัน Error ถ้าหา Element ไม่เจอ
    // 1. แสดงตัวเลขวินาที (ใช้ Math.ceil เพื่อปัดเศษขึ้นเหมือนนาฬิกาทั่วไป)
    let seconds = Math.ceil(timeLeft / 1000);
    // จำกัดเพดานไว้ที่ 5 วินาทีตามกฎเกม
    timerNumber.innerText = Math.max(0, Math.min(seconds, 5));
    // 2. คำนวณความกว้างของหลอด Progress Bar (%)
    let percent = (timeLeft / totalDuration) * 100;
    // บังคับให้อยู่ในช่วง 0 - 100%
    timerBar.style.width = Math.max(0, Math.min(percent, 100)) + "%";
    // 3. เพิ่มลูกเล่นเปลี่ยนสีเมื่อเวลาใกล้หมด (น้อยกว่า 2 วินาที)
    if (seconds <= 2) {
        timerNumber.style.color = "#ff4757"; // สีแดง
    } else {
        timerNumber.style.color = "white";
    }
}
function kickPlayer(targetId) {
    if (confirm("คุณแน่ใจใช่ไหมที่จะเตะผู้เล่นคนนี้ออก?")) {
        socket.emit("kickPlayer", { code: lastState.code, targetClientId: targetId });
    }
}
const realStartBtn = document.getElementById("startGame");

if (realStartBtn) {
    realStartBtn.onclick = () => {
        // เช็คจำนวนคนก่อนกด (ทางฝั่ง Client)
        if (lastState && lastState.players.length < 2) {
            alert("ต้องมีผู้เล่นอย่างน้อย 2 คนครับ");
            return;
        }

        if (room) {
            console.log("Host ส่งคำสั่งเริ่มเกม:", room);
            // ส่งแค่ room code ไป (Server จะเช็ค socket.id ที่ส่งมาเอง)
            socket.emit("startGame", room);
        }
    };
}
