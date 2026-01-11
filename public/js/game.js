const socket = io();
const params = new URLSearchParams(location.search);
const room = params.get("code");
const clientId = params.get("clientId") || localStorage.getItem("clientId");
const playerName = sessionStorage.getItem("playerName") || "ผู้เล่นไร้นาม";
let privateLogs = []; // เอาไว้เก็บ Log จั่วไพ่ของเราเอง
let latestLocalLog = null;
// ตรวจสอบข้อมูลเบื้องต้น
if (!room || !clientId) {
    alert("ข้อมูลไม่ครบถ้วน กำลังกลับหน้าหลัก...");
    location.href = "/";
}

// ส่งสัญญาณเข้าร่วมห้อง
socket.emit("joinRoom", { code: room, name: playerName, clientId: clientId });

let lastState = null;
let selectedCardsIdx = [];
let myLocalHand = []; // เก็บชื่อการ์ดตามลำดับที่เราจัดไว้

/* ===== DOM ELEMENTS ===== */
const roomCodeEl = document.getElementById("roomCode");
const playersEl = document.getElementById("players");
const startBtn = document.getElementById("startGame");
const drawBtn = document.getElementById("draw");
const handEl = document.getElementById("hand");
const deckEl = document.getElementById("deckCount");
const logEl = document.getElementById("gameLog");

const elements = {
    confirmPlay: document.getElementById("confirmPlay"),
    drawBtn: document.getElementById("draw"),
    nopeBtn: document.getElementById("nopeBtn")
};

    let nopeInterval = null; // สร้างตัวแปรไว้นอก function เพื่อคุม Loop
    let lastCardCount = 0; // เก็บจำนวนไพ่ครั้งล่าสุด
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
    lastState = roomState; // อัปเดตข้อมูลล่าสุด
    // เพิ่มตรงนี้: ถ้าเราเคยสั่ง Sort ไว้ ให้ Sort ทุกครั้งที่ได้รับ State ใหม่
    const me = roomState.players.find(p => p.clientId === clientId);
    if (me && me.hand) {
        // ถ้าจำนวนไพ่เพิ่มขึ้น และเป็นตาของเรา (แสดงว่าเพิ่งจั่ว)
        if (me.hand.length > lastCardCount && roomState.players[roomState.turn].clientId === clientId) {
            // เนื่องจากคุณ Sort ตลอดเวลา เราหาไม่ได้ว่าใบไหนคือใบใหม่ 
            // จึงทำได้แค่แจ้งว่าจำนวนไพ่เพิ่มขึ้น หรือถ้าไม่ Sort จะหาใบที่เพิ่มมาได้ครับ
            addLocalLog(`จั่วไพ่ใหม่สำเร็จ (มีไพ่ทั้งหมด ${me.hand.length} ใบ)`, 'info');
        }
        lastCardCount = me.hand.length;
        
        // เรียงไพ่ตามที่คุณต้องการ
        me.hand.sort((a, b) => a.localeCompare(b, 'th'));
    }
    roomCodeEl.innerText = "รหัสห้อง: " + (roomState.code || room);
const playersList = document.getElementById("players");
    if (!playersList) return;

    playersList.innerHTML = ""; // ล้างข้อมูลเก่าทิ้งก่อนวาดใหม่

    roomState.players.forEach((p, index) => {
        const isCurrentTurn = roomState.turn === index;
        const playerDiv = document.createElement("div");
        
        // ใส่ Class เพื่อความสวยงาม (ตาปัจจุบัน, ตายแล้ว)
        playerDiv.className = `player-item ${isCurrentTurn ? 'active-turn' : ''} ${!p.alive ? 'player-dead' : ''}`;
        
        // ดึงจำนวนการ์ด: ถ้าเป็นตัวเราใช้ p.hand.length ถ้าเป็นคนอื่นใน server.js ส่งมาเป็น array ของ "hidden" ก็ใช้ .length ได้เหมือนกัน
        const cardCount = p.hand ? p.hand.length : 0;

        playerDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span>
                    ${isCurrentTurn ? "👉 " : ""}
                    <strong>${p.name}</strong> ${p.clientId === clientId ? "(คุณ)" : ""}
                </span>
                <span>
                    ${p.alive 
                        ? `<span class="badge-cards">🂠 ${cardCount} ใบ</span>` 
                        : `<span style="color: red;">💀 ระเบิดแล้ว</span>`}
                </span>
            </div>
        `;
        
        playersList.appendChild(playerDiv);
})

    // 2. แสดง Log เกม (ต้องอยู่ภายในนี้เพื่อให้รู้จัก roomState)
 if (logEl && roomState.logs) {
    logEl.innerHTML = ""; // ล้างหน้าจอ

    // 1. วาด Log จาก Server (จำกัด 9 บรรทัดล่าสุด)
    const serverLogs = roomState.logs.slice(-9); 
    serverLogs.forEach(l => {
        const div = document.createElement("div");
        
        div.className = `log log-${l.kind || 'system'}`;
        // 🚩 นำค่า l.kind ที่ส่งมาจาก pushLog มาสร้าง class
    const logType = l.kind || 'system'; 
    div.className = `log log-${logType}`; 

    let displayText = l.text;

    if (displayText.includes("แมว") && (displayText.includes("x2") || displayText.includes("x3"))) {
        if (displayText.includes("x2")) {
            displayText = displayText.replace(/แมว[ก-ฮa-zA-Z]*\s*x2/g, "Combo แมว 2 ใบ");
        } else {
            displayText = displayText.replace(/แมว[ก-ฮa-zA-Z]*\s*x3/g, "Combo แมว 3 ใบ");
        }
    }

    div.innerHTML = `<small style="color:gray;">${l.time || ''}</small> ${displayText}`;
    logEl.appendChild(div);
});

    // 2. วาด Local Log (จั่วไพ่ล่าสุดของคุณ) เพียงบรรทัดเดียว
    if (latestLocalLog) {
        const pDiv = document.createElement("div");
        pDiv.className = "log log-private";
        // ใส่สีฟ้าจางๆ เพื่อให้แยกออกว่าเป็น Log ส่วนตัว
        pDiv.style.cssText = "background: rgba(52, 152, 219, 0.1); border-left: 3px solid #3498db; padding: 2px 8px; margin-top: 2px; border-radius: 4px;";
        
        // รูปแบบเวลาจะออกมาเป็น 13:09:37 ตามที่ตั้งค่าไว้
        pDiv.innerHTML = `<small style="color:gray;">${latestLocalLog.time}</small> ${latestLocalLog.text}`;
        logEl.appendChild(pDiv);
    }

    // เลื่อนลงล่างสุดอัตโนมัติ
    logEl.scrollTop = logEl.scrollHeight;
}

    // 3. จัดการปุ่ม Start สำหรับ Host
    const isHost = roomState.hostClientId === clientId;
    if (isHost && !roomState.started) {
        startBtn.classList.remove("hidden");
    } else {
        startBtn.classList.add("hidden");
    }

    // 4. จัดการปุ่มจั่วไพ่
const isMyTurn = roomState.players[roomState.turn].clientId === clientId;
const drawBtn = document.getElementById("draw");

if (!roomState.started) {
    drawBtn.disabled = true;
    drawBtn.innerText = "รอเริ่มเกม...";
} else {
    // กรณีเริ่มเกมแล้ว
    drawBtn.disabled = !isMyTurn || !!roomState.pendingAction || !!roomState.pendingBomb;

    if (isMyTurn) {
        if (roomState.attackStack > 1) {
            // 🚩 แสดงจำนวนครั้งที่ต้องจั่วบนปุ่ม
            drawBtn.innerText = `🔥 จั่วไพ่ (${roomState.attackStack} ครั้ง)`;
            drawBtn.style.background = "#d63031"; // สีแดงแจ้งเตือน
            drawBtn.classList.add("pulse-animation");
        } else {
            drawBtn.innerText = "🃏 จั่วไพ่";
            drawBtn.style.background = ""; // กลับเป็นสีปกติ
            drawBtn.classList.remove("pulse-animation");
        }
    } else {
        // ไม่ใช่ตาของเรา
        const activePlayerName = roomState.players[roomState.turn].name;
        drawBtn.innerText = `ตาของ ${activePlayerName}`;
        drawBtn.style.background = "";
        drawBtn.classList.remove("pulse-animation");
    }
}

// อัปเดตจำนวนกองไพ่
const deckCountEl = document.getElementById("deckCount");
if (deckCountEl) {
    deckEl.innerText = `🂠 กองไพ่เหลือ ${roomState.deck?.length || 0} ใบ`;
}

    // 5. วาดไพ่บนมือ
    renderHand(roomState);
    validateSelection(roomState);
    /* ===== BOMB LOGIC ===== */
const nopeOverlay = document.getElementById("nopeOverlay");
    const nopeBtn = document.getElementById("nopeBtn");
    const timerBar = document.getElementById("timerBar");
    const nopeTitle = document.getElementById("nopeTitle");
    const timerNumber = document.getElementById("timerNumber"); // ดึง Element เลขวินาที
    

    // เคลียร์ Interval เก่าเสมอเมื่อ State เปลี่ยน
    if (nopeInterval) clearInterval(nopeInterval);

    if (roomState.pendingAction) {
        const actingPlayer = roomState.players.find(p => p.clientId === roomState.pendingAction.playerClientId);
        const action = roomState.pendingAction;
        const playerName = actingPlayer ? actingPlayer.name : "ใครบางคน";

        let displayCardName = roomState.pendingAction.card; 
        const useCount = roomState.pendingAction.useCount; // จำนวนใบที่ใช้
    const reqCard = roomState.pendingAction.requestedCard; // ชื่อการ์ดที่ขอ/กู้ชีพ

if (displayCardName === "COMBO_2" || displayCardName.startsWith("แมว")) {
        // ถ้าใน pendingAction มีข้อมูล useCount เป็น 2 (หรือเช็คตาม logic combo 2)
        if (roomState.pendingAction.useCount === 2) {
            displayCardName = "Combo 2 ใบ (สุ่มขโมย)";
        } 
        else if (roomState.pendingAction.useCount === 3) {
            // Combo 3 ใบ: แสดงชื่อการ์ดที่ต้องการขโมย
            displayCardName = `Combo 3 ใบ (ขโมย: ${reqCard || "???"})`;
        }
    } 
    else if (displayCardName === "COMBO_5") {
        // Combo 5 ใบ: แสดงชื่อการ์ดที่ต้องการกู้ชีพ
        displayCardName = `Combo 5 ใบ (กู้ชีพ: ${reqCard || "???"})`;
    }

    // 3. แสดงผลบน Overlay
    if (roomState.pendingAction.noped) {
        nopeTitle.innerHTML = `🚫 การ์ดของ <span style="color:#ffeaa7">${playerName}</span><br>ถูกระงับด้วย "ม่าย"!`;
    } else {
        nopeTitle.innerHTML = `🚨 <span style="color:#ffeaa7">${playerName}</span><br>กำลังใช้ "${displayCardName}"`;
    }

    nopeOverlay.classList.remove("hidden");
        // ฟังก์ชันคำนวณและวาดหลอดเวลา
        
const updateTimer = () => {
    const now = Date.now();
    const timeLeft = action.endAt - now; // เวลาที่เหลือจริง (มิลลิวินาที)
    
    // 1. คำนวณวินาทีให้แม่นยำ
    let secondsContent = Math.ceil(timeLeft / 1000);
    if (secondsContent < 0) secondsContent = 0;

    // 🚩 ป้องกันเลขโดดไป 50: ถ้าวินาทีมากกว่า 10 (ซึ่งผิดปกติสำหรับ Nope) ให้แสดงแค่ 5 หรือตามจริง
    // แต่ทางที่ดีที่สุดคือใช้ Math.min หรือเช็ค timeLeft
    timerNumber.innerText = secondsContent;

    // 2. คำนวณหลอดเวลา (Progress Bar)
    // action.duration ควรส่งมาจาก Server (เช่น 5000) 
    // ถ้าไม่มี ให้ใช้ค่ามาตรฐานที่ระบบตั้งไว้ เช่น 5000 หรือ 7000
    const totalDuration = action.duration || 5000; 
    let percent = (timeLeft / totalDuration) * 100;
    
    if (percent > 100) percent = 100;
    if (percent < 0) percent = 0;
    timerBar.style.width = percent + "%";

    // 3. เปลี่ยนสีเมื่อเหลือน้อย (Animation)
    if (secondsContent <= 2) {
        timerNumber.style.color = "#ff4757";
        timerNumber.classList.add("pulse-fast");
    } else {
        timerNumber.style.color = "white";
        timerNumber.classList.remove("pulse-fast");
    }

    if (timeLeft <= 0) {
        clearInterval(nopeInterval);
        nopeOverlay.classList.add("hidden"); // ปิด Overlay ทันทีเมื่อหมดเวลา
    nopeBtn.disabled = false;
    nopeBtn.innerText = "❌ ม่าย (NOPE)";
}
}
        // เรียกทำงานทันที 1 ครั้ง และตั้ง Loop ให้ทำทุก 50ms เพื่อความลื่น
        updateTimer();
        nopeInterval = setInterval(updateTimer, 50);

        // เช็คสิทธิ์การกด Nope
        const me = roomState.players.find(p => p.clientId === clientId);
        const hasNope = me?.hand.includes("ม่าย");
        const isNotActor = action.playerClientId !== clientId;

        if (hasNope && isNotActor && me.alive) {
            nopeBtn.classList.remove("hidden");
        } else {
            nopeBtn.classList.add("hidden");
        }

    } else {
        // ถ้าไม่มี Action ค้างอยู่ ให้ซ่อน Overlay และหยุดนับ
        nopeOverlay.classList.add("hidden");
        nopeBtn.classList.add("hidden");
        if (nopeInterval) clearInterval(nopeInterval);
    }
renderHand(lastState); // ส่ง lastState ที่ sort แล้วเข้าไปวาด
    validateSelection(lastState);
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

    // ตรวจสอบจำนวนการ์ดจริงที่มีให้เปลี่ยน
    const cardCount = tempFutureOrder.length;

    let cardsHtml = tempFutureOrder.map((c, i) => `
        <div style="background:#444; margin:5px; padding:10px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
            <span>${c}</span>
            <div>
                <button onclick="window.moveFuture(${i}, -1)" ${i === 0 ? 'disabled' : ''}>⬆️</button>
                <button onclick="window.moveFuture(${i}, 1)" ${i === cardCount - 1 ? 'disabled' : ''}>⬇️</button>
            </div>
        </div>
    `).join("");

    overlay.innerHTML = `
        <div class="bomb-modal" style="width:300px;">
            <h2>🌀 เปลี่ยนอนาคต</h2>
            <p><small>${cardCount < 3 ? `กองไพ่เหลือเพียง ${cardCount} ใบสุดท้าย` : 'บนสุดคือใบที่จะถูกจั่ว'}</small></p>
            <div style="text-align:left; margin-bottom:15px;">${cardsHtml}</div>
            <button class="defuse-btn" onclick="window.submitAlter()">ยืนยันลำดับนี้</button>
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


/* ===== เลือกเป้าหมาย (Target Picker) ===== */

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

document.getElementById("sortBtn").onclick = () => {
    console.log("Sort button clicked"); // เพื่อ Check ใน Console ว่าปุ่มทำงานไหม
    if (!lastState) return;

    const me = lastState.players.find(p => p.clientId === clientId);
    if (!me || !me.hand) return;

    // เรียงไพ่ในตัวแปรโลคอล
    me.hand.sort((a, b) => a.localeCompare(b, 'th'));

    // ล้างสถานะการเลือก (ป้องกันการจำ index ผิดหลังจากสลับตำแหน่ง)
    selectedCardsIdx = [];

    // วาดใหม่ทันที
    renderHand(lastState);
    validateSelection(lastState);
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
