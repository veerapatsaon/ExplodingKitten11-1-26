const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.get("/", (_, res) => res.sendFile(__dirname + "/public/lobby.html"));

const rooms = {};

// ===== UTILS =====
function nextAlive(room, fromIndex) {
    if (!room || !room.players || room.players.length === 0) return fromIndex;
    let i = fromIndex;
    const total = room.players.length;
    do {
        i = (i + 1) % total;
    } while (!room.players[i].alive);
    return i;
}

function selectDeckByPlayerCount(playerCount) {
    if (playerCount <= 3) return [...DECKS.small];
    if (playerCount <= 7) return [...DECKS.medium];
    return [...DECKS.large];
}

function genCode() { 
    return Math.floor(Math.random() * 90 + 10).toString(); 
}
function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }

function pushLog(room, kind, text) {
    if (!room.logs) room.logs = [];
    room.logs.push({ time: new Date().toLocaleTimeString("th-TH", { hour12: false }), kind, text });
    if (room.logs.length > 200) room.logs.shift();
}

// 🚩 ฟังก์ชันเช็คผู้ชนะ
function checkWinner(room) {
    const alivePlayers = room.players.filter(p => p.alive);
    if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        pushLog(room, "system", `🎉 เกมจบแล้ว! ผู้ชนะคือ ${winner.name}`);
        io.to(room.code).emit("gameOver", { winnerName: winner.name });
        room.started = false; 
        return true;
    }
    return false;
}

// ====== DECK =====
const DECKS = {
    small: [
      "ข้าม","ข้าม","ข้าม","ข้าม", //4
      "ม่าย","ม่าย","ม่าย","ม่าย",//4
      "โจมตี","โจมตี","โจมตี","โจมตี",//4
      "สับไพ่","สับไพ่",//2
      "ดูอนาคต","ดูอนาคต","ดูอนาคต",//3
      "จั่วจากใต้กอง","จั่วจากใต้กอง","จั่วจากใต้กอง",//3
      "แมวแหล","แมวแหล",//2
      "แมวขนหยิก","แมวขนหยิก","แมวขนหยิก",//3
      "แมวแตงโม","แมวแตงโม","แมวแตงโม",//3
      "แมวทาโก้","แมวทาโก้","แมวทาโก้",//3
      "แมวเบียร์","แมวเบียร์","แมวเบียร์",//3
      "แมวมันฝรั่ง","แมวมันฝรั่ง","แมวมันฝรั่ง",//3
      "เปลี่ยนอนาคต","เปลี่ยนอนาคต",//2
      "แก้ระเบิด","แก้ระเบิด","แก้ระเบิด"],//3
    medium: ["แมวแหล","แมวแหล","แมวแหล","แมวแหล","ข้าม","ข้าม","ข้าม","ข้าม","ข้าม","ข้าม","ม่าย","ม่าย","ม่าย","ม่าย","ม่าย","โจมตี","โจมตี","โจมตี","โจมตี","โจมตี","โจมตี","สับไพ่","สับไพ่","สับไพ่","สับไพ่","ดูอนาคต","ดูอนาคต","ดูอนาคต","จั่วจากใต้กอง","จั่วจากใต้กอง","จั่วจากใต้กอง","จั่วจากใต้กอง","แมวขนหยิก","แมวขนหยิก","แมวขนหยิก","แมวขนหยิก","แมวแตงโม","แมวแตงโม","แมวแตงโม","แมวแตงโม","แมวทาโก้","แมวทาโก้","แมวทาโก้","แมวทาโก้","แมวเบียร์","แมวเบียร์","แมวเบียร์","แมวเบียร์","แมวมันฝรั่ง","แมวมันฝรั่ง","แมวมันฝรั่ง","แมวมันฝรั่ง","เปลี่ยนอนาคต","เปลี่ยนอนาคต","เปลี่ยนอนาคต","เปลี่ยนอนาคต","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด"],
    large: ["แมวแหล","แมวแหล","แมวแหล","แมวแหล","แมวแหล","แมวแหล",,"ข้าม","ข้าม","ข้าม","ข้าม","ข้าม","ข้าม","ข้าม","ข้าม","ข้าม","ข้าม","ม่าย","ม่าย","ม่าย","ม่าย","ม่าย","ม่าย","ม่าย","ม่าย","ม่าย","โจมตี","โจมตี","โจมตี","โจมตี","โจมตี","โจมตี","โจมตี","โจมตี","โจมตี","โจมตี","สับไพ่","สับไพ่","สับไพ่","สับไพ่","สับไพ่","สับไพ่","ดูอนาคต","ดูอนาคต","ดูอนาคต","ดูอนาคต","ดูอนาคต","ดูอนาคต","จั่วจากใต้กอง","จั่วจากใต้กอง","จั่วจากใต้กอง","จั่วจากใต้กอง","แมวขนหยิก","แมวขนหยิก","แมวขนหยิก","แมวขนหยิก","แมวขนหยิก","แมวขนหยิก","แมวขนหยิก","แมวแตงโม","แมวแตงโม","แมวแตงโม","แมวแตงโม","แมวแตงโม","แมวแตงโม","แมวแตงโม","แมวทาโก้","แมวทาโก้","แมวทาโก้","แมวทาโก้","แมวทาโก้","แมวทาโก้","แมวทาโก้","แมวเบียร์","แมวเบียร์","แมวเบียร์","แมวเบียร์","แมวเบียร์","แมวเบียร์","แมวเบียร์","แมวมันฝรั่ง","แมวมันฝรั่ง","แมวมันฝรั่ง","แมวมันฝรั่ง","แมวมันฝรั่ง","แมวมันฝรั่ง","แมวมันฝรั่ง","เปลี่ยนอนาคต","เปลี่ยนอนาคต","เปลี่ยนอนาคต","เปลี่ยนอนาคต","เปลี่ยนอนาคต","เปลี่ยนอนาคต","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด","แก้ระเบิด"]
};

// ===== SOCKET =====
io.on("connection", socket => {
    socket.on("createRoom", ({ name, clientId }) => {
        if (!name || !clientId) return;
        socket.id_clientId_map_attribute = clientId;
        const code = genCode();
        rooms[code] = {
            code, hostClientId: clientId, started: false, turn: 0, attackStack: 0,
            players: [{ clientId, socketId: socket.id, name, hand: [], alive: true }],
            pendingAction: null, discardPile: [],logs: []
        };

        socket.join(code);
        socket.emit("roomJoined", { code });
        io.to(code).emit("state", rooms[code]);
    });

   socket.on("joinRoom", ({ code, name, clientId }) => {
        const room = rooms[code];
        if (!room || !clientId) return;
        socket.id_clientId_map_attribute = clientId;

        let player = room.players.find(p => p.clientId === clientId);
        
        if (player) {
            // กรณีผู้เล่นหน้าเดิม (Reconnect)
            player.socketId = socket.id;
            // ถ้าเกมเริ่มแล้วและเขาเคยตายไปแล้ว ก็ให้ตายเหมือนเดิม
            // แต่ถ้าเขายังรอดอยู่ ก็ให้เล่นต่อได้ (Logic เดิมถูกต้องแล้ว)
        } else {
            // 🚩 กรณีผู้เล่นใหม่เข้ามาระหว่างเกม
            // เช็คว่าเกมเริ่มหรือยัง? ถ้าเริ่มแล้ว ให้ alive = false (เป็นผู้ชม)
            const isSpectator = room.started; 
            
            room.players.push({ 
                clientId, 
                socketId: socket.id, 
                name, 
                hand: [], 
                alive: !isSpectator // ถ้าเกมเริ่มแล้ว = ตาย (false), ถ้ายังไม่เริ่ม = รอด (true)
            });

            if (isSpectator) {
                // แจ้งเตือน Log หน่อยว่ามาดูเฉยๆ
                pushLog(room, "system", `👀 ${name} เข้ามาดูการแข่งขัน`);
            }
        }
        
        socket.join(code);
        socket.emit("roomJoined", { code });
        emitState(io, code, room);
    });

    socket.on("startGame", (code) => {
    const room = rooms[code];
    if (!room) return;

    // 1. เลือกกองการ์ดตามจำนวนผู้เล่น
    let fullDeck = selectDeckByPlayerCount(room.players.length);
    
    // 2. แยก "แก้ระเบิด" ออกจากกองกลางก่อน
    // หาตำแหน่งและดึงการ์ดแก้ระเบิดออกมาพักไว้
    let defuseCards = [];
    fullDeck = fullDeck.filter(card => {
        if (card === "แก้ระเบิด") {
            defuseCards.push(card);
            return false; // ไม่ให้เหลืออยู่ใน fullDeck ชั่วคราว
        }
        return true;
    });

    // 3. เตรียมแจกการ์ดให้ผู้เล่นทุกคน
    room.players.forEach(player => {
        player.hand = [];
        player.alive = true;

        // 🚩 แจกแก้ระเบิด 1 ใบ (หักจากที่เราแยกไว้)
        if (defuseCards.length > 0) {
            player.hand.push(defuseCards.pop());
        }

        // 🃏 แจกการ์ดอื่นๆ เพิ่มอีก 4 ใบ (สุ่มจากกองกลางที่เหลือ)
        shuffle(fullDeck);
        for (let i = 0; i < 4; i++) {
            if (fullDeck.length > 0) {
                player.hand.push(fullDeck.shift());
            }
        }
    });

    // 4. นำ "แก้ระเบิด" ที่เหลือจากการแจก ผสมกลับเข้ากองกลาง
    fullDeck = [...fullDeck, ...defuseCards];

    // 5. นำระเบิดผสมเข้ากอง (จำนวนระเบิด = จำนวนผู้เล่น - 1)
    // (หักระเบิดออกจากกองกลางตามกติกาเดิมของคุณ)
    const bombCountNeeded = room.players.length - 1;
    const bombs = [];
    for (let i = 0; i < room.players.length - 1; i++) {
        bombs.push("ระเบิด");
    }
    
    room.deck = shuffle([...fullDeck, ...bombs]);
    room.started = true;
    room.turn = 0;

    pushLog(room, "system", `🎮 เกมเริ่มแล้ว! (มีระเบิดทั้งหมด ${bombCountNeeded} ใบ)`);
    emitState(io, code, room);
});

socket.on("drawCard", code => {
    const room = rooms[code];
    if (!room || !room.started || room.pendingBomb) return;
    
    // ดึงข้อมูลผู้เล่นคนปัจจุบัน
    const player = room.players[room.turn];
    if (!player || !player.alive) return;
    
    // ตรวจสอบว่า Socket ที่ส่งมา คือเจ้าของตาจริงๆ หรือไม่
    // (เช็คจาก socket.id ที่เชื่อมต่ออยู่ขณะนั้น)
    if (player.socketId !== socket.id) return;
    // 🚩 จั่วเพียงใบเดียวมาพักไว้ในตัวแปร card
    const card = room.deck.pop();
    if (!card) return; // กันเหนียวถ้ากองไพ่หมด

    if (card === "ระเบิด") {
        io.to(code).emit("shakeScreen");
        const defuseIndex = player.hand.indexOf("แก้ระเบิด");

        if (defuseIndex !== -1) {
            room.bombHold = card;
            room.pendingBomb = { playerClientId: player.clientId, maxPos: room.deck.length };
            io.to(player.socketId).emit("showDefusePrompt");
            pushLog(room, "bomb", `⚠️ ${player.name} เจอระเบิด! กำลังตัดสินใจ...`);
        } else {
            player.alive = false;
            pushLog(room, "bomb", `💀 ${player.name} ตัวแตก!`);
            if (checkWinner(room)) return;
            room.turn = nextAlive(room, room.turn);
        }
    } else {
        // 🚩 กรณีได้ไพ่ปกติ: ใส่ในมือ
        player.hand.push(card);
        
        // ส่งบอกผู้เล่นคนนี้คนเดียวว่าได้ใบอะไร (ใส่ไว้ตรงนี้เพื่อไม่ให้บอกชื่อระเบิด)
        socket.emit("drawSuccess", { card: card });

        if (room.attackStack > 0) {
            room.attackStack--;
            if (room.attackStack === 0) {
                room.turn = nextAlive(room, room.turn);
                pushLog(room, "draw", `🃏 ${player.name} จั่วไพ่ (ครบจำนวนแล้ว)`);
            } else {
                pushLog(room, "draw", `🃏 ${player.name} จั่วไพ่ (เหลือที่ต้องจั่วอีก ${room.attackStack} ครั้ง)`);
            }
        } else {
            pushLog(room, "draw", `🃏 ${player.name} จั่วไพ่`);
            room.turn = nextAlive(room, room.turn);
        }
    }
    
    emitState(io, code, room);
});
socket.on("defuseBomb", (code) => {
    const room = rooms[code];
    if (!room || !room.pendingBomb) return;
    
    const player = room.players.find(p => p.clientId === room.pendingBomb.playerClientId);
    if (!player || player.socketId !== socket.id) return;

    const defuseIndex = player.hand.indexOf("แก้ระเบิด");
    if (defuseIndex !== -1) {
        // หักการ์ดแก้ระเบิดออกจากมือ
        const usedCard = player.hand.splice(defuseIndex, 1)[0];
        room.discardPile.push(usedCard);

        pushLog(room, "bomb", `🛡️ ${player.name} ใช้แก้ระเบิดสำเร็จ!`);
        
        // ส่งคำสั่งให้ผู้เล่นเลือกที่วางระเบิดคืนกอง
        socket.emit("chooseBombPosition", room.deck.length);
        
        emitState(io, code, room);
    }
});

// server.js
socket.on("placeBomb", (data) => {
    const { code, position } = data;
    const room = rooms[code];
    
    // ตรวจสอบว่ามีห้องอยู่จริง และมีการถือระเบิดค้างไว้หรือไม่
    if (!room || !room.bombHold) return;

    const player = room.players[room.turn]; 
    if (!player) return;

    const bombCard = room.bombHold;
    
    // นำระเบิดแทรกคืนลงในกองตามตำแหน่งที่ส่งมา (0 = บนสุด, room.deck.length = ล่างสุด)
    const deckSize = room.deck.length;
    let actualIndex = deckSize - position;
    actualIndex = Math.max(0, Math.min(actualIndex, deckSize));

    room.deck.splice(actualIndex, 0, bombCard);

    // เคลียร์ค่าระเบิดที่ถืออยู่
    room.bombHold = null;
    room.pendingBomb = null; // ต้องล้างตัวนี้ด้วย Draw ถึงจะกดได้ต่อ
    room.pendingAction = null;

    if (room.attackStack > 0) {
                room.attackStack--;
                if (room.attackStack === 0) room.turn = nextAlive(room, room.turn);
                pushLog(room, "system", `🛡️ ${player.name} รอดตาย! แต่ยังมีหน้าที่ต้องจั่วต่ออีก ${room.attackStack} ครั้ง`);
            } else {
                room.turn = nextAlive(room, room.turn);
                pushLog(room, "system", `🛡️ ${player.name} วางระเบิดคืนแล้ว จบเทิร์น`);
            }
        emitState(io, code, room);
});
    
    
socket.on("playCard", ({ code, card, targetClientId, useCount, requestedCard }) => {
    const room = rooms[code];
    if (!room || !room.started || room.pendingAction) return;
    const player = room.players[room.turn];
    if (!player || !player.alive) return;

    const needed = useCount || 1;

   if (needed > 1) {
        // ค้นหาการ์ดแมวทั้งหมดในมือ (รวมแมวแหล)
        const allCatsInHand = player.hand.filter(c => c.startsWith("แมว"));
        
        // กรองหาแมวชนิดที่เลือก + แมวแหล
        const selectedGroup = player.hand.filter(c => c === card || c === "แมวแหล");

        if (selectedGroup.length < needed) return;

        // ลบไพ่ออกตามจำนวน (ลำดับความสำคัญ: ลบแมวปกติก่อน ถ้าไม่พอค่อยลบแมวแหล)
        let removed = 0;
        player.hand = player.hand.filter(c => {
            if (removed < needed && (c === card || c === "แมวแหล")) {
                removed++;
                room.discardPile.push(c);
                return false;
            }
            return true;
        });
    } else {
        // กรณีเล่นใบเดียวปกติ
        const idx = player.hand.indexOf(card);
        if (idx === -1) return;
        room.discardPile.push(player.hand.splice(idx, 1)[0]);
    }
    // --- จบส่วนแก้ไข ---

    room.pendingAction = { 
        playerClientId: player.clientId, 
        card, // ชื่อการ์ดหลักที่ใช้เรียก Action
        targetClientId,
        useCount: needed,
        requestedCard,
        endAt: Date.now() + 5000,
        duration: 5000
    };

    const logTitle = needed > 1 ? `Combo แมว x${needed}` : `การ์ด [${card}]`;
const logKind = needed > 1 ? "combo" : card; // ใช้ชื่อการ์ดเป็น kind เลย เช่น "attack", "shuffle"
    emitState(io, code, room);
    room.nopeTimer = setTimeout(() => resolvePendingAction(code), 5000);
});

 socket.on("playNope", code => {
    const room = rooms[code];
    if (!room || !room.pendingAction) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || !player.alive) return;

    const cardIndex = player.hand.indexOf("ม่าย");
    if (cardIndex !== -1) {
        player.hand.splice(cardIndex, 1);
        room.discardPile.push("ม่าย");

      // สลับสถานะ: true = โดนหยุด, false = ทำงานปกติ
    room.pendingAction.noped = !room.pendingAction.noped;
    room.pendingAction.endAt = Date.now() + 5000; // Reset เวลาใหม่

    if (room.nopeTimer) clearTimeout(room.nopeTimer);
    room.nopeTimer = setTimeout(() => resolvePendingAction(code), 5000);

        pushLog(room, "nope", `🔥 ${player.name} ใช้ "ม่าย"!`);
        
        // ✅ ใช้ฟังก์ชัน emitState ที่เราสร้างไว้ข้างบน
        emitState(io, code, room);
    }
});
    socket.on("playFiveCombo", ({ code, cards, requestedCard }) => {
    const room = rooms[code];
    if (!room || !room.started || room.pendingAction) return;
    const player = room.players[room.turn];

    // ตรวจสอบว่ามีไพ่ทั้ง 5 ใบจริงไหม

    let hasAll = true;
    const tempHand = [...player.hand];
    cards.forEach(c => {
        const idx = tempHand.indexOf(c);
        if (idx === -1) hasAll = false;
        else tempHand.splice(idx, 1);
    });

    if (!hasAll) return;

    // ลบไพ่ 5 ใบนั้นออก
    cards.forEach(c => {
        const idx = player.hand.indexOf(c);
        room.discardPile.push(player.hand.splice(idx, 1)[0]);
    });

    room.pendingAction = {
        playerClientId: player.clientId,
        card: "COMBO_5",
        useCount: 5,
        requestedCard: requestedCard,
        endAt: Date.now() + 5000,
        duration: 5000
    };

    pushLog(room, "system", `⏳ ${player.name} จ่าย 5 ใบไม่ซ้ำเพื่อกู้ชีพ "${requestedCard}"`);
    emitState(io, code, room);
    room.nopeTimer = setTimeout(() => resolvePendingAction(code), 5000);
});

socket.on("submitFutureOrder", ({ code, order }) => {
    const room = rooms[code];
    if (!room || !room.pendingAction) return;

    // ตรวจสอบว่า order เป็น Array และมีข้อมูล
    if (Array.isArray(order) && order.length > 0) {
        // ✅ วิธีแก้: 
        // 1. ไพ่ใน 'order' ที่ส่งมาจาก Client ลำดับคือ [บนสุด, กลาง, ล่าง]
        // 2. เราต้อง 'reverse' มันก่อน เพื่อให้ใบที่ 'บนสุด' ไปอยู่ท้ายสุดของ Array (รอการ .pop())
        const newTopCards = [...order].reverse();

        // 3. แทนที่ไพ่ 3 ใบสุดท้ายของกอง (ท้าย Array) ด้วยลำดับที่สลับใหม่
        const startIndex = Math.max(0, room.deck.length - newTopCards.length);
        room.deck.splice(startIndex, newTopCards.length, ...newTopCards);
        
        pushLog(room, "system", "🌀 อนาคตถูกเปลี่ยนแปลงแล้ว...");
        room.pendingAction = null;
        emitState(io, code, room);
    }
});
// --- เพิ่มไว้ใน io.on("connection", socket => { ... }) ---

// 🚩 1. เตะผู้เล่น
socket.on("kickPlayer", ({ code, targetClientId }) => {
    const room = rooms[code];
    if (!room || room.hostClientId !== socket.id_clientId_map_attribute) { 
        // ตรวจสอบว่าเป็น Host จริงไหม (เปรียบเทียบจาก room.hostClientId)
        const host = room.players.find(p => p.clientId === room.hostClientId);
        if (!host || host.socketId !== socket.id) return;
    }

    const playerIndex = room.players.findIndex(p => p.clientId === targetClientId);
    if (playerIndex === -1) return;

    const kickedPlayer = room.players[playerIndex];
    const wasAlive = kickedPlayer.alive;

    if (room.started && wasAlive) {
        // --- 🃏 ส่วนการจัดการ Turn (ข้ามตา) ---
        // ถ้าคนที่ถูกเตะ กำลังเล่นอยู่ในขณะนี้พอดี
        if (room.turn === playerIndex) {
            // หาคนถัดไปที่ยังมีชีวิตอยู่ (โดยเริ่มหาจากตำแหน่งคนที่จะถูกเตะ)
            room.turn = nextAlive(room, playerIndex);
            
            // เคลียร์ค่าสถานะค้างต่างๆ เช่น กำลังถูก Attack หรือรอใส่ระเบิดคืนกอง
            room.pendingAction = null; 
            room.pendingBomb = null;
        } 
        // ถ้าคนที่ถูกเตะ อยู่ก่อนหน้าคนปัจจุบัน (ทำให้ Index ของคนปัจจุบันลดลง 1 หลังลบ)
        else if (room.turn > playerIndex) {
            room.turn--;
        }

        // 🃏 คืนการ์ดในมือลงกองแบบสุ่ม (ยกเว้นแก้ระเบิด)
        kickedPlayer.hand.forEach(card => {
                const randomIndex = Math.floor(Math.random() * (room.deck.length + 1));
                room.deck.splice(randomIndex, 0, card);
            
        });

        // 💣 เพิ่มระเบิด 1 ใบลงกอง (เพราะจำนวนผู้เล่นลดลง แต่ระเบิดต้องเท่าเดิมหรือเพิ่มความโหด)
        const bombPos = Math.floor(Math.random() * room.deck.length);
        room.deck.splice(bombPos, 0, "ระเบิด");
        
        pushLog(room, "system", `🚫 ${kickedPlayer.name} ถูกเตะออก! (คืนไพ่ลงกองและเพิ่มระเบิด 1 ใบ)`);
    } else {
        pushLog(room, "system", `🚫 ${kickedPlayer.name} ถูกเตะออกจากห้อง`);
    }

    if (kickedPlayer.socketId) {
        io.to(kickedPlayer.socketId).emit("kicked");
    }

    // ลบผู้เล่นออกจาก Array
    room.players.splice(playerIndex, 1);

    // ตรวจสอบคนชนะใหม่เผื่อเหลือคนเดียว
    if (room.started) checkWinner(room);

    emitState(io, code, room);
});

// 🔄 2. Reset เกม
socket.on("resetGame", (code) => {
    const room = rooms[code];
    const host = room.players.find(p => p.clientId === room.hostClientId);
    if (!host || host.socketId !== socket.id) return;

    room.started = false;
    room.deck = [];
    room.discardPile = [];
    room.attackStack = 0;
    room.turn = 0;
    room.pendingAction = null;
    room.pendingBomb = null;
    room.players.forEach(p => { p.hand = []; p.alive = true; });

    pushLog(room, "system", "🔄 Host ได้ทำการรีเซ็ตห้องใหม่");
    emitState(io, code, room);
});

}); //ปิด Connection


function resolvePendingAction(code) {
    const room = rooms[code];
    if (!room || !room.pendingAction) return;

    // ✅ ถ้า noped เป็น true หมายความว่าผลสุดท้ายคือการ์ดถูกระงับ
    if (room.pendingAction.noped) {
        pushLog(room, "system", `🚫 ผลของการ์ด ${room.pendingAction.card} ถูกยกเลิกโดย "ม่าย"`);
        room.pendingAction = null;
        room.nopeTimer = null;
        emitState(io, code, room);
        return; // จบการทำงาน ไม่เข้า switch(card) ด้านล่าง
    }

    const { playerClientId, card } = room.pendingAction;
    const player = room.players.find(p => p.clientId === playerClientId && p.alive);
    if (!player) {
        room.pendingAction = null;
        return;
    }
    switch (card) {
        case "จั่วจากใต้กอง": {
    const bottomCard = room.deck.shift();
    const drawnCard = room.deck.shift(); 
player.hand.push(drawnCard);
    if (bottomCard === "ระเบิด") {
        const defIndex = player.hand.indexOf("แก้ระเบิด");
        if (defIndex !== -1) {
            // 🚩 แก้ไขตรงนี้ด้วย
            room.bombHold = bottomCard;
            room.pendingBomb = { playerClientId: player.clientId, maxPos: room.deck.length };
            // ส่งสัญญาณให้หน้าจอคนจั่วเด้งปุ่ม Defuse
            io.to(room.code).emit("shakeScreen");
            io.to(player.socketId).emit("showDefusePrompt");
            pushLog(room, "bomb", `🛡️ ${player.name} จั่วใต้กองเจอระเบิดแต่แก้ได้!`);
        } else {
            player.alive = false;
            pushLog(room, "bomb", `💀 ${player.name} เจอระเบิดใต้กองและระเบิดตู้ม!`);
            if (checkWinner(room)) return;
            room.turn = nextAlive(room, room.turn);
        }
    } else {
        player.hand.push(bottomCard);
        pushLog(room, "draw", `🃏 ${player.name} จั่วการ์ดใต้กอง`);
        if (room.attackStack > 0) {
            room.attackStack--;
            if (room.attackStack === 0) room.turn = nextAlive(room, room.turn);
        } else {
    io.to(player.socketId).emit("drawSuccess", { card: bottomCard });
        
  room.turn = nextAlive(room, room.turn);
        }
    }
    break;
}
        case "ข้าม":
        // 🚩 แก้ไข Logic: ถ้ามี Attack Stack ให้หักออก 1
        if (room.attackStack > 0) {
            room.attackStack--;
            pushLog(room, "skip", `🛡️ ${player.name} ใช้การ์ดข้าม หักล้างการจั่ว (เหลือต้องจั่ว: ${room.attackStack})`);
            
            // ถ้าหักแล้วเหลือ 0 ถึงจะเปลี่ยนเทิร์นไปคนถัดไป
            if (room.attackStack === 0) {
                room.turn = nextAlive(room, room.turn);
            }
        } else {
            // กรณีปกติ (ไม่มี Stack) ให้ข้ามเทิร์นทันที
            pushLog(room, "skip", `⏩ ${player.name} ข้ามเทิร์น`);
            room.turn = nextAlive(room, room.turn);
        }
        break;
        case "โจมตี": room.attackStack += 2; room.turn = nextAlive(room, room.turn);
        pushLog(room, "attack", `⚔️ ${player.name} ใช้การ์ด [โจมตี] (เพิ่มตาเล่นให้คนถัดไป)`);
        break;
        case "สับไพ่": room.deck = shuffle(room.deck); 
        pushLog(room, "shuffle", `🔀 ${player.name} ใช้การ์ด [สับไพ่]`);
        break;
        case "ดูอนาคต": io.to(player.socketId).emit("futureCards", room.deck.slice(-3).reverse()); 
        pushLog(room, "future", `👁️ ${player.name} ใช้การ์ด [ดูอนาคต]`);
        break;
        case "เปลี่ยนอนาคต": io.to(player.socketId).emit("reorderFuture", room.deck.slice(-3).reverse()); return;
        // ใน resolvePendingAction ภายใน switch(card)
case "COMBO_5": {
    const requestedCard = room.pendingAction.requestedCard; // ใบที่เลือกจากกองทิ้ง
    const discardIndex = room.discardPile.indexOf(requestedCard);

    if (discardIndex !== -1) {
        // ดึงออกจากกองทิ้งมาให้ผู้เล่น
        const cardFromDiscard = room.discardPile.splice(discardIndex, 1)[0];
        player.hand.push(cardFromDiscard);
        pushLog(room, "system", `♻️ ${player.name} กู้ชีพการ์ด "${cardFromDiscard}" จากกองทิ้ง`);
    }
    break;
}
case "แมวขนหยิก":
case "แมวแตงโม":
case "แมวทาโก้":
case "แมวเบียร์":
case "แมวแหล":
case "แมวมันฝรั่ง": {
    const targetId = room.pendingAction.targetClientId;
    const reqCard = room.pendingAction.requestedCard; 
    const target = room.players.find(p => p.clientId === targetId && p.alive);

    if (!target) {
        pushLog(room, "system", "❌ ไม่พบเป้าหมาย หรือเป้าหมายออกไปแล้ว");
        break;
    }
    if (target.hand.length === 0) {
        pushLog(room, "system", `❌ ${target.name} ไม่มีไพ่ในมือให้ขโมย!`);
        break;
    }

    if (reqCard) { // กรณี Combo 3 ใบ (ระบุชื่อ)
        const cardIndex = target.hand.indexOf(reqCard);
        if (cardIndex !== -1) {
            const stolen = target.hand.splice(cardIndex, 1)[0];
            player.hand.push(stolen);
            pushLog(room, "steal", `👑 ${player.name} ขโมย "${stolen}" จาก ${target.name} สำเร็จ!`);
        } else {
            pushLog(room, "steal", `❌ ${player.name} พยายามขโมย "${reqCard}" แต่ ${target.name} ไม่มี`);
        }
    } else { // กรณี Combo 2 ใบ (สุ่ม)
        const randIdx = Math.floor(Math.random() * target.hand.length);
        const stolen = target.hand.splice(randIdx, 1)[0];
        player.hand.push(stolen);
        pushLog(room, "steal", `😼 ${player.name} สุ่มขโมยไพ่จาก ${target.name} "`);
    }
    break;
}
    }
    room.pendingAction = null;
    emitState(io, code, room);
}
// สร้างฟังก์ชันช่วยส่ง State ที่จะลบข้อมูลที่ไม่ได้ใช้และเสี่ยงต่อการวนลูปออก
function emitState(io, code, room) {
    if (!room) return;

    // 1. สร้าง Object ใหม่สำหรับส่งออกโดยเฉพาะ (Shallow Copy)
    // วิธีนี้จะช่วยเลี่ยงปัญหา Circular Structure จาก Timeout Object ได้ดีกว่า JSON.parse
    const { nopeTimer, ...restOfRoom } = room; 
    
    // 2. Clone ข้อมูลที่เหลือ (Optional: ถ้าต้องการความชัวร์ว่าไม่กระทบข้อมูลจริง)
    // แต่ปกติใช้ restOfRoom ก็เพียงพอสำหรับการ emit แล้วครับ
    const stateToSend = { ...restOfRoom };

    // 3. คำนวณเวลาที่เหลือ ณ วินาทีที่ส่ง
    if (stateToSend.pendingAction && stateToSend.pendingAction.endAt) {
        stateToSend.pendingAction.remaining = Math.max(0, stateToSend.pendingAction.endAt - Date.now());
    }

    // 4. ส่งข้อมูล
    io.to(code).emit("state", stateToSend);
}

// เวลาจะส่งข้อมูล ให้เรียกใช้ emitState(io, code, room) แทน io.to(code).emit(...)
function renderTimerUI(timeLeft, totalDuration) {
    const timerNumber = document.getElementById("timerNumber");
    const timerBar = document.getElementById("timerBar");
    
    // แสดงวินาที (ใช้ Math.min กันเหนียวไว้ที่ 5 วิ)
    let seconds = Math.ceil(timeLeft / 1000);
    timerNumber.innerText = Math.min(seconds, 5);

    // คำนวณหลอด %
    let percent = (timeLeft / totalDuration) * 100;
    timerBar.style.width = Math.max(0, Math.min(percent, 100)) + "%";
}

function handleAfterDraw(room, player) {
    if (room.attackStack > 0) {
        room.attackStack--;
        if (room.attackStack === 0) {
            room.turn = nextAlive(room, room.turn);
        }
    } else {
        room.turn = nextAlive(room, room.turn);
    }
}

server.listen(PORT, '0.0.0.0', () => { // ใส่ '0.0.0.0' เพื่อให้รับการเชื่อมต่อจากภายนอกได้ดีขึ้น
    console.log(`เซิร์ฟเวอร์รันที่พอร์ต ${PORT}`);
});
