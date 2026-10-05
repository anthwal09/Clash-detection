const BASE_URL = "http://localhost:8080/api/timetable";

let fullData = [];
let latestClashes = [];
let skippedData = [];
let originalWorkbook = null;
let chartInstance = null;

// ---------------- LOGIN ----------------
async function initSystem(event) {
    if (event) event.preventDefault();

    const email = document.getElementById("user")?.value?.trim().toLowerCase() || "";
    const password = document.getElementById("pass")?.value?.trim() || "";

    console.log("Trying login:", email, password);

    try {
        const res = await fetch("http://127.0.0.1:8080/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const role = (await res.text()).trim();

        console.log("Status:", res.status);
        console.log("Login response:", role);

        if (role === "ADMIN" || role === "FACULTY" || role === "STUDENT") {
            showDashboard(role);
        } else {
            alert(role);
        }

    } catch (err) {
        console.error("Login error:", err);
        alert("Login failed: " + err.message);
    }
}
function forgotPass(e) {
    if (e) e.preventDefault();

    const box = document.getElementById("forgotBox");
    if (box) {
        box.style.display = "block";
    }
}

function closeForgot() {
    const box = document.getElementById("forgotBox");
    if (box) {
        box.style.display = "none";
    }
}
function showDashboard(role) {
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("dashboardPage").style.display = "block";

    console.log("Logged in as:", role);

    // reset hidden things on each login
    document.querySelectorAll("button").forEach(btn => btn.style.display = "");
    const fileInput = document.getElementById("excelFile");
    if (fileInput) fileInput.style.display = "";

    if (role === "ADMIN") return;

    const hideButtons = ["Auto Fix", "Download", "Send To Backend"];

    document.querySelectorAll("button").forEach(btn => {
        if (hideButtons.some(text => btn.innerText.includes(text))) {
            btn.style.display = "none";
        }
    });

    // Faculty and Student both load saved/final timetable
    loadTimetableFromBackend();

    if (role === "STUDENT") {
        if (fileInput) fileInput.style.display = "none";

        document.querySelectorAll("button").forEach(btn => {
            if (btn.innerText.includes("Scan")) {
                btn.style.display = "none";
            }
        });

        // student should not see clashes/fixed section
        const wrappers = document.querySelectorAll(".table-wrapper");
        const titles = document.querySelectorAll(".section-title");

        // keep All Timetable Data visible
        if (titles[1]) titles[1].style.display = "none";   // Detected Clashes
        if (wrappers[1]) wrappers[1].style.display = "none";

        if (titles[2]) titles[2].style.display = "none";   // Fixed Entries
        if (wrappers[2]) wrappers[2].style.display = "none";
    }
}
   async function loadTimetableFromBackend() {
    try {
        const res = await fetch("http://127.0.0.1:8080/api/timetable/all");

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        console.log("Loaded timetable from backend:", data);

        fullData = data.map((row, index) => ({
            id: row.id ? String(row.id) : `backend_${index}`,
            sheet: "Backend",
            section: row.section || "",
            day: row.day || "",
            startTime: row.startTime || "",
            endTime: row.endTime || "",
            startMinutes: timeToMinutes(row.startTime),
            endMinutes: timeToMinutes(row.endTime),
            subjectCode: row.subjectCode || "",
            subjectName: row.subjectName || "",
            faculty: row.faculty || "UNKNOWN",
            room: row.room || "",
            rawCell: row.subjectName || row.subjectCode || "",
            label: row.subjectName || row.subjectCode || "",
            fixed: false
        })).filter(r => r.day && r.startMinutes != null && r.endMinutes != null);

        skippedData = [];
        latestClashes = detectClashes(fullData);

        updateStats();
        renderTable();
        renderClashTable();
        renderFixedTable();
        updateChart();

    } catch (err) {
        console.error("Backend timetable load error:", err);
        alert("Could not load timetable from backend: " + err.message);
    }
}
function logout() {
    document.getElementById("dashboardPage").style.display = "none";
    document.getElementById("loginPage").style.display = "flex";
    document.getElementById("user").value = "";
    document.getElementById("pass").value = "";

    fullData = [];
    latestClashes = [];
    skippedData = [];
    originalWorkbook = null;

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    updateStats();
    renderTable();
    renderClashTable();
    renderFixedTable();

    document.querySelectorAll("button").forEach(btn => {
        btn.style.display = "";
    });

    const fileInput = document.getElementById("excelFile");
    if (fileInput) {
        fileInput.style.display = "";
        fileInput.value = "";
    }
}
async function sendOtp() {
    const email = document.getElementById("fpEmail").value.trim().toLowerCase();

    if (!email) {
        alert("Enter email first");
        return;
    }

    try {
        const res = await fetch("http://127.0.0.1:8080/api/auth/forgot-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
        });

        const msg = await res.text();
        console.log("OTP Response:", msg);
        alert(msg);

    } catch (err) {
        console.error("OTP Error:", err);
        alert("Failed to send OTP");
    }
}
async function verifyOtp() {
    const email = document.getElementById("fpEmail").value.trim().toLowerCase();
    const otp = document.getElementById("fpOtp").value.trim();

    const res = await fetch("http://127.0.0.1:8080/api/auth/verify-otp", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email, otp })
    });

    const msg = await res.text();
    alert(msg);
}
async function resetPassword() {
    const email = document.getElementById("fpEmail").value.trim().toLowerCase();
    const newPassword = document.getElementById("fpNewPass").value.trim();

    const res = await fetch("http://127.0.0.1:8080/api/auth/reset-password", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email, newPassword })
    });

    const msg = await res.text();
    alert(msg);
}
// ---------------- HELPERS ----------------
function norm(v) {
    return String(v ?? "")
        .replace(/\r/g, "")
        .replace(/\u00a0/g, " ")
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function upper(v) {
    return norm(v).toUpperCase();
}

function unique(arr) {
    return [...new Set(arr.map(norm).filter(Boolean))];
}

function overlaps(a1, a2, b1, b2) {
    return a1 < b2 && b1 < a2;
}

function smartJoin(parts) {
    return parts
        .map(x => norm(x))
        .filter(Boolean)
        .join(" ")
        .replace(/Methodol\s+ogy/gi, "Methodology")
        .replace(/Methodolo\s+gy/gi, "Methodology")
        .replace(/Resear\s+ch/gi, "Research")
        .replace(/KP\s*CR\s*4\s*0/gi, "KP CR40")
        .replace(/CR\s*4\s*0/gi, "CR40")
        .replace(/LAB\s*0?(\d+)/gi, "LAB$1")
        .replace(/LT\s*0?(\d+)/gi, "LT$1")
        .replace(/\s+/g, " ")
        .trim();
}

function isGarbageSection(v) {
    const s = upper(v);
    return !s || /^TABLE\s*\d+$/i.test(s) || s === "TIME TABLE" || s === "TIMETABLE";
}

// ---------------- TIME ----------------
function timeToMinutes(str) {
    if (!str) return null;

    const s = String(str).replace(/\./g, ":").toUpperCase().trim();
    const m = s.match(/(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)/);
    if (!m) return null;

    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3];

    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;

    return h * 60 + min;
}

function minutesToTime(mins) {
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const ap = h >= 12 ? "PM" : "AM";

    if (h === 0) h = 12;
    else if (h > 12) h -= 12;

    return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

function parseTimeRange(text) {
    const raw = String(text || "").replace(/\./g, ":").toUpperCase();
    const times = raw.match(/\d{1,2}:\d{2}\s*(AM|PM)/g);
    if (!times || times.length < 2) return null;

    const start = timeToMinutes(times[0]);
    const end = timeToMinutes(times[1]);
    if (start == null || end == null) return null;

    return {
        startMinutes: start,
        endMinutes: end,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end)
    };
}

function isTimeCell(v) {
    return !!parseTimeRange(v);
}

function isDay(v) {
    return ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].includes(upper(v));
}

// ---------------- EXTRACT ----------------
function extractSubjectCode(text) {
    const raw = upper(text);

    const patterns = [
        /\b[A-Z]{2,5}\s?-?\s?\d{2,4}\b/,
        /\b[A-Z]{2,5}\s?LAB\s?\d*\b/
    ];

    for (const p of patterns) {
        const m = raw.match(p);
        if (m) return m[0].replace(/\s+/g, "").replace("-", "").toUpperCase();
    }
    return "";
}

function extractFacultyHint(text) {
    const m = norm(text).match(/\(([^)]+)\)/);
    return m ? norm(m[1]) : "";
}

function extractRoom(text) {
    const raw = smartJoin([text]).toUpperCase();

    const patterns = [
        /\bKP\s*CR\s*-?\s*\d+[A-Z]?\b/i,
        /\bNEW\s*LAB\s*-?\s*\d+[A-Z]?\b/i,
        /\bLT\s*-?\s*\d+[A-Z]?\b/i,
        /\bLAB\s*-?\s*\d+[A-Z]?\b/i,
        /\bCR\s*-?\s*\d+[A-Z]?\b/i,
        /\bDL\s*-?\s*\d+[A-Z]?\b/i,
        /\bROOM\s*-?\s*\d+[A-Z]?\b/i,
        /\bAUDITORIUM\b/i,
        /\bSEMINAR\s*HALL\b/i,
        /\bLIB\b/i
    ];

    for (const p of patterns) {
        const m = raw.match(p);
        if (m) {
            return norm(m[0])
                .replace(/\s*-\s*/g, "")
                .replace(/\s+/g, " ")
                .toUpperCase();
        }
    }
    return "";
}

function shouldIgnoreText(text) {
    const s = upper(text);
    if (!s) return true;

    const ignore = [
        "TIME", "TIME ", "DAYS", "DAYS ", "DAY",
        "SUBJECT CODE", "SUBJECT NAME", "FACULTY", "ROOM",
        "LUNCH", "BREAK", "S.NO", "S NO", "SR NO", "SR. NO."
    ];

    if (ignore.includes(s)) return true;
    if (isDay(s)) return true;
    if (isTimeCell(s)) return true;

    return false;
}

function isOnlyRoomOrJunk(parsed) {
    const raw = upper(parsed.rawCell);
    const room = upper(parsed.room);

    if (!parsed.subjectCode && !parsed.subjectName && !parsed.faculty) return true;
    if (!parsed.subjectCode && !parsed.subjectName && room && raw === room) return true;

    const junk = [
        "PLACEMENT",
        "CLASS",
        "METHODOLOGY",
        "SWAYAM",
        "TRAINING",
        "EXTRA-CURRICULAR",
        "LIB"
    ];

    if (!parsed.subjectCode && junk.some(x => raw.includes(x))) return true;

    return false;
}

// ---------------- MATRIX ----------------
function fillMergedMatrix(ws) {
    if (!ws || !ws["!ref"]) return [];

    const range = XLSX.utils.decode_range(ws["!ref"]);
    const matrix = [];

    for (let r = 0; r <= range.e.r; r++) {
        matrix[r] = [];
        for (let c = 0; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            matrix[r][c] = cell ? cell.v : "";
        }
    }

    const merges = ws["!merges"] || [];
    for (const merge of merges) {
        const val = matrix[merge.s.r]?.[merge.s.c] || "";
        for (let r = merge.s.r; r <= merge.e.r; r++) {
            for (let c = merge.s.c; c <= merge.e.c; c++) {
                if (!matrix[r]) matrix[r] = [];
                if (!matrix[r][c]) matrix[r][c] = val;
            }
        }
    }

    return matrix;
}

// ---------------- SECTION ----------------
function extractSectionName(matrix, sheetName) {
    const candidates = [];

    for (let r = 0; r < Math.min(8, matrix.length); r++) {
        for (let c = 0; c < (matrix[r] || []).length; c++) {
            const val = norm(matrix[r][c]);
            const s = upper(val);

            if (!val || isGarbageSection(val)) continue;
            if (isTimeCell(val) || isDay(val)) continue;
            if (["SUBJECT CODE", "SUBJECT NAME", "FACULTY", "TIME", "DAYS"].includes(s)) continue;

            if (/\b(MCA|BCA|BTECH|B\.TECH|BBA|MBA|SECTION|SEM|SEMESTER)\b/i.test(val)) {
                candidates.push(val);
            }
        }
    }

    if (candidates.length) return smartJoin([candidates[0]]);
    return isGarbageSection(sheetName) ? "" : sheetName;
}

// ---------------- LEGEND ----------------
function findLegendRow(matrix) {
    for (let r = 0; r < matrix.length; r++) {
        let hasCode = false;
        let hasName = false;

        for (let c = 0; c < (matrix[r] || []).length; c++) {
            const v = upper(matrix[r][c]);
            if (v === "SUBJECT CODE") hasCode = true;
            if (v === "SUBJECT NAME") hasName = true;
        }

        if (hasCode && hasName) return r;
    }
    return -1;
}

function findColumnIndex(row, target) {
    for (let c = 0; c < row.length; c++) {
        if (upper(row[c]) === target) return c;
    }
    return -1;
}

function buildSubjectMap(matrix, legendRow) {
    const header = matrix[legendRow] || [];
    const codeCol = findColumnIndex(header, "SUBJECT CODE");
    const nameCol = findColumnIndex(header, "SUBJECT NAME");
    const facultyCol = findColumnIndex(header, "FACULTY");

    const subjectMap = {};
    let lastCode = "";

    for (let r = legendRow + 1; r < matrix.length; r++) {
        const code = codeCol >= 0 ? norm(matrix[r][codeCol]) : "";
        const name = nameCol >= 0 ? norm(matrix[r][nameCol]) : "";
        const faculty = facultyCol >= 0 ? norm(matrix[r][facultyCol]) : "";

        const extractedCode = extractSubjectCode(code);

        if (extractedCode) {
            subjectMap[extractedCode] = {
                subjectName: smartJoin([name]),
                faculty: smartJoin([faculty])
            };
            lastCode = extractedCode;
        } else if (!code && lastCode) {
            if (name && !isDay(name) && !isTimeCell(name)) {
                subjectMap[lastCode].subjectName = smartJoin([
                    subjectMap[lastCode].subjectName,
                    name
                ]);
            }

            if (!subjectMap[lastCode].faculty && faculty) {
                subjectMap[lastCode].faculty = smartJoin([faculty]);
            }
        }
    }

    return subjectMap;
}

// ---------------- TIMETABLE PARSE ----------------
function findTimeRow(matrix, legendRow) {
    for (let r = 0; r < legendRow; r++) {
        let count = 0;

        for (let c = 0; c < (matrix[r] || []).length; c++) {
            if (isTimeCell(matrix[r][c])) count++;
        }

        if (count >= 2) return r;
    }

    return -1;
}

function getTimeSlots(matrix, timeRow) {
    const slots = [];

    for (let c = 0; c < (matrix[timeRow] || []).length; c++) {
        const parsed = parseTimeRange(matrix[timeRow][c]);
        if (!parsed) continue;

        const prev = slots[slots.length - 1];

        if (
            prev &&
            prev.startMinutes === parsed.startMinutes &&
            prev.endMinutes === parsed.endMinutes &&
            c === prev.endCol + 1
        ) {
            prev.endCol = c;
        } else {
            slots.push({
                startCol: c,
                endCol: c,
                ...parsed
            });
        }
    }

    return slots;
}

function getDayBlocks(matrix, timeRow, legendRow) {
    const dayRows = [];

    for (let r = timeRow + 1; r < legendRow; r++) {
        for (let c = 0; c < Math.min(3, (matrix[r] || []).length); c++) {
            if (isDay(matrix[r][c])) {
                dayRows.push({
                    row: r,
                    day: upper(matrix[r][c])
                });
                break;
            }
        }
    }

    const blocks = [];

    for (let i = 0; i < dayRows.length; i++) {
        blocks.push({
            day: dayRows[i].day,
            startRow: dayRows[i].row,
            endRow: i + 1 < dayRows.length ? dayRows[i + 1].row - 1 : legendRow - 1
        });
    }

    return blocks;
}

function collectStructuredSlotText(matrix, startRow, endRow, startCol, endCol) {
    const texts = [];

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            const val = matrix[r]?.[c];

            if (shouldIgnoreText(val)) continue;

            const t = norm(val);
            if (t) texts.push(t);
        }
    }

    const uniqTexts = unique(texts);

    return {
        rawText: smartJoin(uniqTexts),
        allTexts: uniqTexts
    };
}

function parseCellText(rawText, subjectMap) {
    const raw = smartJoin([rawText]);
    if (!raw) return null;

    let subjectCode = extractSubjectCode(raw);
    let room = extractRoom(raw);
    let facultyHint = extractFacultyHint(raw);

    let mapped = subjectMap[subjectCode] || {};
    let subjectName = mapped.subjectName || "";
    let faculty = mapped.faculty || facultyHint || "";

    if (!subjectCode || !subjectName || !faculty) {
        const rawLow = raw.toLowerCase();

        for (const code in subjectMap) {
            const name = subjectMap[code].subjectName || "";

            if (name && rawLow.includes(name.toLowerCase().slice(0, 8))) {
                subjectCode = subjectCode || code;
                subjectName = subjectName || name;
                faculty = faculty || subjectMap[code].faculty || "";
                break;
            }
        }
    }

    if (!subjectName && subjectCode && subjectMap[subjectCode]) {
        subjectName = subjectMap[subjectCode].subjectName || subjectCode;
    }

    const parsed = {
        rawCell: raw,
        subjectCode,
        subjectName,
        faculty: faculty || "UNKNOWN",
        facultyHint,
        room,
        label: subjectName || subjectCode || raw
    };

    if (isOnlyRoomOrJunk(parsed)) return null;

    return parsed;
}

function parseSheet(sheetName, ws) {
    const matrix = fillMergedMatrix(ws);
    const rows = [];
    const skipped = [];

    const legendRow = findLegendRow(matrix);

    if (legendRow === -1) {
        skipped.push({ sheet: sheetName, reason: "Legend row not found" });
        return { rows, skipped };
    }

    const subjectMap = buildSubjectMap(matrix, legendRow);

    const timeRow = findTimeRow(matrix, legendRow);

    if (timeRow === -1) {
        skipped.push({ sheet: sheetName, reason: "Time row not found" });
        return { rows, skipped };
    }

    const slots = getTimeSlots(matrix, timeRow);
    const dayBlocks = getDayBlocks(matrix, timeRow, legendRow);
    const sectionName = extractSectionName(matrix, sheetName) || sheetName;

    if (!slots.length) {
        skipped.push({ sheet: sheetName, reason: "No time slots found" });
        return { rows, skipped };
    }

    if (!dayBlocks.length) {
        skipped.push({ sheet: sheetName, reason: "No day blocks found" });
        return { rows, skipped };
    }

    for (const block of dayBlocks) {
        for (const slot of slots) {
            const collected = collectStructuredSlotText(
                matrix,
                block.startRow,
                block.endRow,
                slot.startCol,
                slot.endCol
            );

            if (!collected.rawText) continue;

            const parsed = parseCellText(collected.rawText, subjectMap);
            if (!parsed) continue;

            rows.push({
                id: `${sheetName}_${block.day}_${slot.startMinutes}_${slot.endMinutes}_${rows.length + 1}`,
                sheet: sheetName,
                section: sectionName,
                day: block.day,
                startTime: slot.startTime,
                endTime: slot.endTime,
                startMinutes: slot.startMinutes,
                endMinutes: slot.endMinutes,
                subjectCode: parsed.subjectCode,
                subjectName: parsed.subjectName,
                faculty: parsed.faculty,
                facultyHint: parsed.facultyHint,
                room: parsed.room,
                rawCell: parsed.rawCell,
                label: parsed.label,
                fixed: false
            });
        }
    }

    return { rows, skipped };
}

function parseWorkbook(workbook) {
    const allRows = [];
    const skipped = [];

    workbook.SheetNames.forEach(sheetName => {
        const parsed = parseSheet(sheetName, workbook.Sheets[sheetName]);
        allRows.push(...parsed.rows);
        skipped.push(...parsed.skipped);
    });

    return { rows: allRows, skipped };
}

// ---------------- CLEAN DATA ----------------
function cleanParsedData(data) {
    const seen = new Set();
    const cleaned = [];

    data.forEach(row => {
        const hasUsefulData =
            row.day &&
            row.startMinutes != null &&
            row.endMinutes != null &&
            (row.subjectCode || row.subjectName || row.faculty || row.room || row.rawCell);

        if (!hasUsefulData) return;
        if (!row.subjectCode && !row.subjectName) return;

        const rawKey = upper(row.subjectCode || row.subjectName || row.label || row.rawCell);

        const key = [
            upper(row.section || row.sheet),
            upper(row.day),
            row.startMinutes,
            row.endMinutes,
            rawKey,
            upper(row.faculty),
            upper(row.room)
        ].join("|");

        if (!seen.has(key)) {
            seen.add(key);
            cleaned.push(row);
        }
    });

    return cleaned;
}

function isSameLecture(a, b) {
    return (
        upper(a.section) === upper(b.section) &&
        upper(a.day) === upper(b.day) &&
        a.startMinutes === b.startMinutes &&
        a.endMinutes === b.endMinutes &&
        upper(a.subjectCode || a.subjectName || a.label || a.rawCell) ===
            upper(b.subjectCode || b.subjectName || b.label || b.rawCell) &&
        upper(a.room) === upper(b.room) &&
        upper(a.faculty) === upper(b.faculty)
    );
}

// ---------------- EXCEL ----------------
function processExcel() {
    const fileInput = document.getElementById("excelFile");

    if (!fileInput || !fileInput.files.length) {
        alert("Please upload an Excel file first.");
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            originalWorkbook = XLSX.read(data, { type: "array" });

            const result = parseWorkbook(originalWorkbook);

            fullData = cleanParsedData(result.rows);
            skippedData = result.skipped;
            latestClashes = detectClashes(fullData);

            console.log("Full Data:", fullData);
            console.log("Clashes:", latestClashes);
            console.log("Skipped:", skippedData);

            updateStats();
            renderTable();
            renderClashTable();
            renderFixedTable();
            updateChart();

            alert(
                `Excel read successfully.\n` +
                `Parsed Rows: ${fullData.length}\n` +
                `Clashes: ${latestClashes.length}`
            );
        } catch (err) {
            console.error(err);
            alert("Excel read error: " + err.message);
        }
    };

    reader.readAsArrayBuffer(fileInput.files[0]);
}

// ---------------- CLASH ----------------
function detectClashes(data) {
    const clashes = [];
    const seen = new Set();
    const validRows = cleanParsedData(data);

    for (let i = 0; i < validRows.length; i++) {
        for (let j = i + 1; j < validRows.length; j++) {
            const a = validRows[i];
            const b = validRows[j];

            if (a.id === b.id) continue;
            if (isSameLecture(a, b)) continue;
            if (upper(a.day) !== upper(b.day)) continue;
            if (!overlaps(a.startMinutes, a.endMinutes, b.startMinutes, b.endMinutes)) continue;

            const reasons = [];

            if (a.room && b.room && upper(a.room) === upper(b.room)) {
                reasons.push("Room Clash");
            }

            if (
                a.faculty &&
                b.faculty &&
                upper(a.faculty) !== "UNKNOWN" &&
                upper(b.faculty) !== "UNKNOWN" &&
                upper(a.faculty) === upper(b.faculty)
            ) {
                reasons.push("Faculty Clash");
            }

            const sameSection =
                a.section &&
                b.section &&
                upper(a.section) === upper(b.section);

            const sameSubject =
                upper(a.subjectCode || a.subjectName) ===
                upper(b.subjectCode || b.subjectName);

            if (sameSection && !sameSubject) {
                reasons.push("Section Clash");
            }

            if (reasons.length) {
                const key = [a.id, b.id].sort().join("|");

                if (!seen.has(key)) {
                    seen.add(key);
                    clashes.push({
                        reasons,
                        entry1: a,
                        entry2: b
                    });
                }
            }
        }
    }

    return clashes;
}

// ---------------- AUTO FIX ----------------
function getAllRooms(data) {
    return unique(data.map(x => norm(x.room)).filter(Boolean));
}

function getAllSlots(data) {
    const map = new Map();

    data.forEach(row => {
        const key = `${row.day}|${row.startMinutes}|${row.endMinutes}`;

        if (!map.has(key)) {
            map.set(key, {
                day: row.day,
                startMinutes: row.startMinutes,
                endMinutes: row.endMinutes,
                startTime: row.startTime,
                endTime: row.endTime
            });
        }
    });

    return Array.from(map.values());
}

function candidateHasConflict(candidate, data, selfId) {
    for (const row of data) {
        if (row.id === selfId) continue;
        if (upper(row.day) !== upper(candidate.day)) continue;
        if (!overlaps(candidate.startMinutes, candidate.endMinutes, row.startMinutes, row.endMinutes)) continue;

        if (
            candidate.room &&
            row.room &&
            upper(candidate.room) === upper(row.room)
        ) {
            return true;
        }

        if (
            candidate.faculty &&
            row.faculty &&
            upper(candidate.faculty) !== "UNKNOWN" &&
            upper(row.faculty) !== "UNKNOWN" &&
            upper(candidate.faculty) === upper(row.faculty)
        ) {
            return true;
        }

        if (
            candidate.section &&
            row.section &&
            upper(candidate.section) === upper(row.section) &&
            upper(candidate.subjectCode || candidate.subjectName) !==
                upper(row.subjectCode || row.subjectName)
        ) {
            return true;
        }
    }

    return false;
}

function scoreCandidate(original, candidate) {
    let score = 0;

    if (upper(original.day) === upper(candidate.day)) score += 50;
    if (upper(original.room) === upper(candidate.room)) score += 20;

    score -= Math.abs(original.startMinutes - candidate.startMinutes) / 5;

    if (candidate.room) score += 10;
    if (candidate.faculty) score += 10;

    return score;
}

function findBestAlternative(row, data, rooms, slots) {
    const candidates = [];

    for (const slot of slots) {
        const roomOptions = unique([row.room, ...rooms]).filter(Boolean);

        for (const room of roomOptions) {
            const candidate = {
                ...row,
                ...slot,
                room
            };

            const sameOld =
                upper(candidate.day) === upper(row.day) &&
                candidate.startMinutes === row.startMinutes &&
                candidate.endMinutes === row.endMinutes &&
                upper(candidate.room) === upper(row.room);

            if (sameOld) continue;

            if (!candidateHasConflict(candidate, data, row.id)) {
                candidates.push(candidate);
            }
        }
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => scoreCandidate(row, b) - scoreCandidate(row, a));

    return candidates[0];
}

function autoFixAll() {
    if (!fullData.length) {
        alert("Upload Excel first.");
        return;
    }

    const working = JSON.parse(JSON.stringify(fullData));
    const rooms = getAllRooms(working);
    const slots = getAllSlots(working);

    let changed = true;
    let pass = 0;

    while (changed && pass < 10) {
        changed = false;
        pass++;

        const clashes = detectClashes(working);

        if (!clashes.length) break;

        for (const clash of clashes) {
            const targetId = clash.entry2.id;
            const idx = working.findIndex(r => r.id === targetId);

            if (idx === -1) continue;

            const best = findBestAlternative(working[idx], working, rooms, slots);

            if (best) {
                working[idx] = {
                    ...working[idx],
                    ...best,
                    fixed: true
                };
                changed = true;
            }
        }
    }

    fullData = cleanParsedData(working);
    latestClashes = detectClashes(fullData);

    updateStats();
    renderTable();
    renderClashTable();
    renderFixedTable();
    updateChart();

    alert(`Auto Fix Done.\nRemaining Clashes: ${latestClashes.length}`);
}

// ---------------- BACKEND ----------------
async function sendToBackend() {
    if (!fullData.length) {
        alert("No data to send.");
        return;
    }

    try {
        const payload = cleanParsedData(fullData).map(row => ({
            section: row.section || row.sheet || "",
            day: row.day || "",
            startTime: row.startTime || "",
            endTime: row.endTime || "",
            subjectCode: row.subjectCode || "",
            subjectName: row.subjectName || row.label || row.rawCell || "",
            faculty: row.faculty || row.facultyHint || "UNKNOWN",
            room: row.room || ""
        }));

        const saveRes = await fetch(`${BASE_URL}/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!saveRes.ok) throw new Error(`Save failed HTTP ${saveRes.status}`);

        const savedData = await saveRes.json();
        console.log("Saved Data:", savedData);

        const clashRes = await fetch(`${BASE_URL}/clashes`);

        if (!clashRes.ok) throw new Error(`Clash check failed HTTP ${clashRes.status}`);

        const clashes = await clashRes.json();
        console.log("Backend Clashes:", clashes);

        alert(
            `Saved successfully.\n` +
            `Total Entries: ${savedData.length}\n` +
            `Backend Clashes: ${clashes.length}\n\n` +
            `Check Spring Boot terminal for printed report.`
        );

    } catch (err) {
        console.error("Backend Error:", err);
        alert("Backend error: " + err.message);
    }
}

// ---------------- DOWNLOAD ----------------
function downloadFixedTimetable() {
    if (!fullData.length) {
        alert("No data to export.");
        return;
    }

    const exportRows = cleanParsedData(fullData).map((r, i) => ({
        S_No: i + 1,
        Sheet: r.sheet,
        Section: r.section,
        Day: r.day,
        Start_Time: r.startTime,
        End_Time: r.endTime,
        Subject_Code: r.subjectCode,
        Subject_Name: r.subjectName,
        Faculty: r.faculty,
        Room: r.room,
        Raw_Cell: r.rawCell,
        Fixed: r.fixed ? "Yes" : "No"
    }));

    latestClashes = detectClashes(fullData);

    const clashRows = latestClashes.map((c, i) => ({
        S_No: i + 1,
        Reasons: c.reasons.join(", "),
        Entry1_Section: c.entry1.section,
        Entry1_Day: c.entry1.day,
        Entry1_Time: `${c.entry1.startTime} - ${c.entry1.endTime}`,
        Entry1_Subject: c.entry1.subjectCode || c.entry1.subjectName,
        Entry1_Faculty: c.entry1.faculty,
        Entry1_Room: c.entry1.room,
        Entry2_Section: c.entry2.section,
        Entry2_Day: c.entry2.day,
        Entry2_Time: `${c.entry2.startTime} - ${c.entry2.endTime}`,
        Entry2_Subject: c.entry2.subjectCode || c.entry2.subjectName,
        Entry2_Faculty: c.entry2.faculty,
        Entry2_Room: c.entry2.room
    }));

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(exportRows),
        "Fixed Timetable"
    );

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(clashRows),
        "Clashes"
    );

    XLSX.writeFile(wb, "clash_pro_fixed_timetable.xlsx");
}

// ---------------- UI ----------------
function updateStats() {
    const validRows = cleanParsedData(fullData);
    const fixedCount = fullData.filter(r => r.fixed).length;

    if (document.getElementById("totalRows")) {
        document.getElementById("totalRows").textContent = validRows.length;
    }

    if (document.getElementById("totalClashes")) {
        document.getElementById("totalClashes").textContent = latestClashes.length;
    }

    if (document.getElementById("fixedCount")) {
        document.getElementById("fixedCount").textContent = fixedCount;
    }

    if (document.getElementById("skippedRows")) {
        document.getElementById("skippedRows").textContent = skippedData.length;
    }
}

function getClashInfoForRow(row) {
    const matched = latestClashes.filter(
        c => c.entry1.id === row.id || c.entry2.id === row.id
    );

    return {
        isClash: matched.length > 0,
        reasons: unique(matched.flatMap(c => c.reasons))
    };
}

function getFilteredRows() {
    const status = document.getElementById("statusFilter")?.value || "all";
    const q = upper(document.getElementById("searchBox")?.value || "");

    return cleanParsedData(fullData).filter(row => {
        const clashInfo = getClashInfoForRow(row);

        if (status === "clash" && !clashInfo.isClash) return false;
        if (status === "safe" && clashInfo.isClash) return false;

        if (q) {
            const combined = upper([
                row.section,
                row.day,
                row.startTime,
                row.endTime,
                row.subjectCode,
                row.subjectName,
                row.faculty,
                row.room,
                row.rawCell
            ].join(" "));

            if (!combined.includes(q)) return false;
        }

        return true;
    });
}

function renderTable() {
    const tbody = document.getElementById("dataTableBody");

    if (!tbody) {
        console.table(fullData);
        return;
    }

    tbody.innerHTML = "";

    getFilteredRows().forEach(r => {
        const clashInfo = getClashInfoForRow(r);

        const statusBadge = clashInfo.isClash
            ? `<span class="badge badge-clash">Clash</span>`
            : `<span class="badge badge-ok">Safe</span>`;

        const tr = document.createElement("tr");

        if (clashInfo.isClash) tr.classList.add("row-clash");
        if (r.fixed) tr.classList.add("row-fixed");

        tr.innerHTML = `
            <td>${statusBadge}</td>

            <td>
                <strong>${r.day || "-"}</strong><br>
                <small>${r.startTime || ""} - ${r.endTime || ""}</small><br>
                <small>${r.section || ""}</small>
            </td>

            <td>
                <strong>${r.subjectCode || "-"}</strong><br>
                <small>${r.subjectName || r.label || r.rawCell || ""}</small><br>
                <small>${r.faculty || ""}</small>
            </td>

            <td>${r.room || "-"}</td>

            <td>
                ${
                    clashInfo.isClash
                        ? clashInfo.reasons
                            .map(reason => `<span class="badge badge-clash">${reason}</span>`)
                            .join(" ")
                        : `<span class="badge badge-ok">No conflict</span>`
                }
            </td>

            <td>
                ${
                    r.fixed
                        ? `<span class="badge badge-ok">Auto Fixed</span>`
                        : "-"
                }
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function renderClashTable() {
    const tbody = document.getElementById("clashTableBody");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (!latestClashes.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="safe-text">No clashes detected</td>
            </tr>
        `;
        return;
    }

    latestClashes.forEach(c => {
        const tr = document.createElement("tr");
        tr.classList.add("row-clash");

        tr.innerHTML = `
            <td>
                ${c.reasons.map(r => `<span class="badge badge-clash">${r}</span>`).join(" ")}
            </td>

            <td>
                <strong>${c.entry1.section || "-"}</strong><br>
                <small>${c.entry1.day} | ${c.entry1.startTime} - ${c.entry1.endTime}</small><br>
                <strong>${c.entry1.subjectCode || "-"}</strong><br>
                <small>${c.entry1.subjectName || c.entry1.label || "-"}</small><br>
                <small>Faculty: ${c.entry1.faculty || "-"}</small><br>
                <small>Room: ${c.entry1.room || "-"}</small>
            </td>

            <td>
                <strong>${c.entry2.section || "-"}</strong><br>
                <small>${c.entry2.day} | ${c.entry2.startTime} - ${c.entry2.endTime}</small><br>
                <strong>${c.entry2.subjectCode || "-"}</strong><br>
                <small>${c.entry2.subjectName || c.entry2.label || "-"}</small><br>
                <small>Faculty: ${c.entry2.faculty || "-"}</small><br>
                <small>Room: ${c.entry2.room || "-"}</small>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function renderFixedTable() {
    const tbody = document.getElementById("fixedTableBody");

    if (!tbody) return;

    tbody.innerHTML = "";

    const fixedRows = cleanParsedData(fullData).filter(r => r.fixed);

    if (!fixedRows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">No fixed entries yet. Click Auto Fix All Clashes.</td>
            </tr>
        `;
        return;
    }

    fixedRows.forEach(r => {
        const tr = document.createElement("tr");
        tr.classList.add("row-fixed");

        tr.innerHTML = `
            <td>${r.section || "-"}</td>

            <td>
                <strong>${r.day || "-"}</strong><br>
                <small>${r.startTime || ""} - ${r.endTime || ""}</small>
            </td>

            <td>
                <strong>${r.subjectCode || "-"}</strong><br>
                <small>${r.subjectName || r.label || "-"}</small>
            </td>

            <td>${r.faculty || "-"}</td>
            <td>${r.room || "-"}</td>
        `;

        tbody.appendChild(tr);
    });
}

function updateChart() {
    const canvas = document.getElementById("chart");

    if (!canvas || typeof Chart === "undefined") return;

    const total = cleanParsedData(fullData).length;
    const clashes = latestClashes.length;
    const fixed = fullData.filter(r => r.fixed).length;
    const safe = Math.max(total - clashes, 0);

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: ["Safe", "Clashes", "Fixed"],
            datasets: [
                {
                    data: [safe, clashes, fixed]
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

function applyFiltersAndRender() {
    renderTable();
    renderClashTable();
    renderFixedTable();
}

const renderParsedRows = renderTable;


// ---------------- FORGOT PASSWORD UI ----------------
let otpTimer;

function openForgotScreen(e) {
    if (e) e.preventDefault();

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("forgotScreen").style.display = "flex";
}

function backToLogin() {
    document.getElementById("forgotScreen").style.display = "none";
    document.getElementById("loginPage").style.display = "flex";
}

function startTimer() {
    let time = 300;
    const el = document.getElementById("otpTimer");

    clearInterval(otpTimer);

    otpTimer = setInterval(() => {
        let m = Math.floor(time / 60);
        let s = time % 60;

        el.innerText = `OTP expires in ${m}:${s < 10 ? "0"+s : s}`;

        time--;

        if (time < 0) {
            clearInterval(otpTimer);
            el.innerText = "OTP expired. Resend OTP.";
        }
    }, 1000);
}

async function sendOtp() {
    const email = document.getElementById("fpEmail").value;

    const res = await fetch("http://127.0.0.1:8080/api/auth/forgot-password", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email })
    });

    const msg = await res.text();
    alert(msg);

    if (msg === "OTP SENT") startTimer();
}
function searchTable() {
    const input = document.getElementById("searchInput");
    if (!input) return;

    const value = input.value.toLowerCase();
    const rows = document.querySelectorAll("#dataTableBody tr");

    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(value) ? "" : "none";
    });
}