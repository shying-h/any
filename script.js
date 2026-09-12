const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatMessages = document.getElementById("chat-messages");
const aiStatus = document.getElementById("ai-status");
const newChatButton = document.getElementById("new-chat");
const voiceToggle = document.getElementById("voice-toggle");
const voiceInput = document.getElementById("voice-input");
const memoryView = document.getElementById("memory-view");
const memoryDialog = document.getElementById("memory-dialog");
const memoryList = document.getElementById("memory-list");
const memoryCount = document.getElementById("memory-count");
const memoryClose = document.getElementById("memory-close");
const memoryClear = document.getElementById("memory-clear");
const diaryView = document.getElementById("diary-view");
const diaryDialog = document.getElementById("diary-dialog");
const diaryClose = document.getElementById("diary-close");
const diaryEnabled = document.getElementById("diary-enabled");
const diaryList = document.getElementById("diary-list");
const diaryCount = document.getElementById("diary-count");
const diaryClear = document.getElementById("diary-clear");
const emotionGrowth = document.getElementById("emotion-growth");
const careView = document.getElementById("care-view");
const careDialog = document.getElementById("care-dialog");
const careForm = document.getElementById("care-form");
const careClose = document.getElementById("care-close");
const careEnabled = document.getElementById("care-enabled");
const careTime = document.getElementById("care-time");
const quietStart = document.getElementById("quiet-start");
const quietEnd = document.getElementById("quiet-end");
const carePermissionStatus = document.getElementById("care-permission-status");
const careFeedback = document.getElementById("care-feedback");
const careTest = document.getElementById("care-test");
const anyaAvatar = document.getElementById("anya-avatar");
const moodLabel = document.getElementById("mood-label");
const relationshipLabel = document.getElementById("relationship-label");
const liveCaption = document.getElementById("live-caption");
const agentStage = document.querySelector(".agent-stage");
const avatarHalo = document.querySelector(".avatar-halo");
const voiceSpectrum = document.getElementById("voice-spectrum");
const spectrumBarCount = 48;
const spectrumBars = Array.from({ length: spectrumBarCount }, (_, index) => {
  const bar = document.createElement("span");
  const angle = (index / spectrumBarCount) * Math.PI * 2;
  bar.style.left = `${50 + Math.sin(angle) * 47}%`;
  bar.style.top = `${50 - Math.cos(angle) * 47}%`;
  bar.style.setProperty("--bar-angle", `${index * (360 / spectrumBarCount)}deg`);
  const rhythm = (Math.sin(index * 1.7) + Math.sin(index * .58) + 2) / 4;
  bar.style.setProperty("--idle-low", `${5 + rhythm * 3}px`);
  bar.style.setProperty("--idle-mid", `${9 + rhythm * 7}px`);
  bar.style.setProperty("--idle-peak", `${14 + rhythm * 11}px`);
  bar.style.setProperty("--idle-settle", `${8 + rhythm * 6}px`);
  bar.style.animationDelay = `${-index * 44}ms`;
  bar.style.animationDuration = `${1500 + (index % 5) * 110}ms`;
  voiceSpectrum.appendChild(bar);
  return bar;
});
let conversationTurn = 0;
let userName = "";
let lastTopic = "";
let lastDetail = "";
let voiceEnabled = false;
let microphoneStream = null;
let audioContext = null;
let meterFrame = null;
let outputFrame = null;
let voiceTranscript = "";
let realtimePc = null;
let realtimeChannel = null;
let realtimeAudio = null;
let realtimeConnected = false;
let realtimeConnecting = false;
let realtimeReplyText = "";
let realtimeAvailable = false;

function loadMemory() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("anya-memory") || "{}"); } catch {}
  const savedEmotion = saved.emotionalState && typeof saved.emotionalState === "object" ? saved.emotionalState : {};
  const savedRelationship = saved.relationship && typeof saved.relationship === "object" ? saved.relationship : {};
  return {
    name: typeof saved.name === "string" ? saved.name : "",
    likes: Array.isArray(saved.likes) ? saved.likes : [],
    dislikes: Array.isArray(saved.dislikes) ? saved.dislikes : [],
    importantPeople: Array.isArray(saved.importantPeople) ? saved.importantPeople : [],
    importantThings: Array.isArray(saved.importantThings) ? saved.importantThings : [],
    recentTopics: Array.isArray(saved.recentTopics) ? saved.recentTopics : saved.lastTopic ? [saved.lastTopic] : [],
    moodHistory: Array.isArray(saved.moodHistory) ? saved.moodHistory : saved.mood ? [{ value: saved.mood, at: Date.now() }] : [],
    emotionalState: {
      warmth: Number.isFinite(savedEmotion.warmth) ? savedEmotion.warmth : .52,
      energy: Number.isFinite(savedEmotion.energy) ? savedEmotion.energy : .5,
      concern: Number.isFinite(savedEmotion.concern) ? savedEmotion.concern : .16,
      tone: typeof savedEmotion.tone === "string" ? savedEmotion.tone : "calm",
    },
    relationship: {
      trust: Number.isFinite(savedRelationship.trust) ? savedRelationship.trust : 0,
      familiarity: Number.isFinite(savedRelationship.familiarity) ? savedRelationship.familiarity : 0,
      turns: Number.isFinite(savedRelationship.turns) ? savedRelationship.turns : 0,
      days: Array.isArray(savedRelationship.days) ? savedRelationship.days : [],
      lastVisit: typeof savedRelationship.lastVisit === "string" ? savedRelationship.lastVisit : "",
    },
    emotionDiary: Array.isArray(saved.emotionDiary) ? saved.emotionDiary : [],
    diaryEnabled: saved.diaryEnabled !== false,
    updatedAt: saved.updatedAt || Date.now(),
  };
}

const companionMemory = loadMemory();
userName = companionMemory.name;

function setEmotion(emotion = "calm") {
  agentStage.classList.remove("emotion-happy", "emotion-sad", "emotion-worried", "emotion-shy", "emotion-calm");
  agentStage.classList.add(`emotion-${emotion}`);
  document.body.dataset.emotion = emotion;
}

function detectEmotion(text) {
  if (/(开心|高兴|快乐|好耶|うれしい|喜欢|成功)/i.test(text)) return "happy";
  if (/(难过|伤心|委屈|哭|孤独|失恋|寂寞)/i.test(text)) return "sad";
  if (/(焦虑|压力|害怕|担心|紧张|怎么办|不安)/i.test(text)) return "worried";
  if (/(害羞|不好意思|脸红|秘密|喜欢你)/i.test(text)) return "shy";
  return "calm";
}

const emotionNames = { happy: "明亮", sad: "低落", worried: "紧绷", shy: "柔软", calm: "平静" };

function analyzeEmotion(text) {
  const scores = { happy: 0, sad: 0, worried: 0, shy: 0, calm: .35 };
  const rules = {
    happy: [/(开心|高兴|快乐|成功|好耶|うれしい|期待|谢谢|喜欢)/gi, 1.15],
    sad: [/(难过|伤心|委屈|失望|孤独|寂寞|哭|不想说话)/gi, 1.25],
    worried: [/(焦虑|压力|害怕|担心|紧张|怎么办|来不及|不安|烦)/gi, 1.2],
    shy: [/(害羞|不好意思|秘密|脸红|喜欢你|想你)/gi, 1],
  };
  Object.entries(rules).forEach(([emotion, [pattern, weight]]) => {
    scores[emotion] += (text.match(pattern) || []).length * weight;
  });
  if (/！{2,}|!{2,}/.test(text)) scores.happy += .45;
  if (/……|\.\.\.|唉|唔/.test(text)) scores.sad += .4;
  if (/？{2,}|\?{2,}/.test(text)) scores.worried += .35;
  if (text.length > 70) scores.calm += .22;
  const [tone, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return { tone, intensity: Math.min(1, .25 + score / 2.4), scores };
}

function relationshipStage() {
  const relation = companionMemory.relationship;
  const depth = relation.trust * .58 + relation.familiarity * .42;
  if (depth >= 72) return "很珍惜与你分享的日常";
  if (depth >= 48) return "相处得熟悉而安心";
  if (depth >= 27) return "聊天越来越有默契";
  if (depth >= 11) return "渐渐记住了你的习惯";
  return "正在慢慢认识你";
}

function updateRelationshipLabel() {
  relationshipLabel.textContent = relationshipStage();
}

function updateEmotionDiary(analysis, text) {
  if (!companionMemory.diaryEnabled) return;
  const date = new Date().toLocaleDateString("sv-SE");
  let entry = companionMemory.emotionDiary.find((item) => item.date === date);
  if (!entry) {
    entry = { date, counts: { happy: 0, sad: 0, worried: 0, shy: 0, calm: 0 }, moments: [], total: 0 };
    companionMemory.emotionDiary.push(entry);
  }
  entry.counts[analysis.tone] = (entry.counts[analysis.tone] || 0) + analysis.intensity;
  entry.total += 1;
  if (text.length >= 5) {
    entry.moments.push(text.replace(/\s+/g, " ").slice(0, 72));
    entry.moments = entry.moments.slice(-3);
  }
  companionMemory.emotionDiary = companionMemory.emotionDiary.slice(-30);
}

function evolveFromConversation(text) {
  const analysis = analyzeEmotion(text);
  const state = companionMemory.emotionalState;
  const targets = {
    happy: { warmth: .82, energy: .82, concern: .08 },
    sad: { warmth: .8, energy: .3, concern: .82 },
    worried: { warmth: .72, energy: .38, concern: .88 },
    shy: { warmth: .86, energy: .48, concern: .2 },
    calm: { warmth: .62, energy: .48, concern: .18 },
  }[analysis.tone];
  const blend = .18 + analysis.intensity * .17;
  ["warmth", "energy", "concern"].forEach((key) => {
    state[key] = Math.max(0, Math.min(1, state[key] * (1 - blend) + targets[key] * blend));
  });
  state.tone = analysis.tone;

  const relation = companionMemory.relationship;
  relation.turns += 1;
  relation.familiarity = Math.min(100, relation.familiarity + .8 + Math.min(1.8, text.length / 90));
  const personal = /(我觉得|我希望|我害怕|我喜欢|我讨厌|我的|请记住|秘密|第一次)/.test(text);
  relation.trust = Math.min(100, relation.trust + .45 + (personal ? 1.5 : 0));
  const today = new Date().toLocaleDateString("sv-SE");
  if (!relation.days.includes(today)) relation.days.push(today);
  relation.days = relation.days.slice(-60);
  relation.lastVisit = today;

  companionMemory.moodHistory.push({ value: emotionNames[analysis.tone], tone: analysis.tone, intensity: analysis.intensity, at: Date.now() });
  companionMemory.moodHistory = companionMemory.moodHistory.slice(-30);
  updateEmotionDiary(analysis, text);
  setEmotion(analysis.tone);
  updateRelationshipLabel();
  return analysis;
}

function dominantDiaryMood(entry) {
  return Object.entries(entry.counts || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "calm";
}

function diarySummary(entry, tone) {
  const moment = entry.moments?.at(-1);
  const openings = {
    happy: "今天的心情里有明显的亮光",
    sad: "今天似乎有些事情压在心上",
    worried: "今天的思绪有一点紧绷",
    shy: "今天有一些柔软又含蓄的心情",
    calm: "今天整体比较平稳",
  };
  return moment ? `${openings[tone]}。你提到：“${moment}”` : `${openings[tone]}。`;
}

function renderDiary() {
  diaryEnabled.checked = companionMemory.diaryEnabled;
  diaryList.innerHTML = "";
  const entries = companionMemory.emotionDiary.slice().reverse();
  diaryCount.textContent = `${entries.length} 天记录`;
  diaryClear.disabled = entries.length === 0;
  const state = companionMemory.emotionalState;
  emotionGrowth.innerHTML = `
    <div class="growth-card"><span>此刻的情绪</span><strong>${emotionNames[state.tone] || "平静"}</strong></div>
    <div class="growth-card"><span>相处的感觉</span><strong>${relationshipStage()}</strong></div>
    <div class="growth-card"><span>最近的节奏</span><strong>${state.energy > .68 ? "轻快" : state.energy < .38 ? "安静" : "舒缓"}</strong></div>`;
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "diary-empty";
    empty.textContent = companionMemory.diaryEnabled ? "聊过一些心情后，这里会出现每天的温柔小结。" : "自动记录已关闭。";
    diaryList.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const tone = dominantDiaryMood(entry);
    const day = document.createElement("article");
    day.className = "diary-day";
    day.innerHTML = `<header><time>${entry.date}</time><span class="diary-mood">${emotionNames[tone]}</span></header><p></p>`;
    day.querySelector("p").textContent = diarySummary(entry, tone);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "diary-remove";
    remove.textContent = "删除当天";
    remove.addEventListener("click", () => {
      companionMemory.emotionDiary = companionMemory.emotionDiary.filter((item) => item.date !== entry.date);
      saveMemory();
      renderDiary();
    });
    day.appendChild(remove);
    diaryList.appendChild(day);
  });
}

function drawSpectrum(values) {
  spectrumBars.forEach((bar, index) => {
    const mirroredIndex = index < spectrumBars.length / 2 ? index : spectrumBars.length - 1 - index;
    const value = values[mirroredIndex % values.length] || 0;
    bar.style.height = `${8 + value * 42}px`;
    bar.style.opacity = `${0.36 + value * 0.64}`;
  });
}

function resetSpectrum() {
  voiceSpectrum.classList.remove("active");
  spectrumBars.forEach((bar) => {
    bar.style.height = "9px";
    bar.style.opacity = ".5";
  });
}

async function startMicrophoneMeter(stream = null) {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    microphoneStream = stream || await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(microphoneStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = .68;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      analyser.getByteFrequencyData(data);
      const values = Array.from(data.slice(1, 15), (value) => Math.min(1, value / 155));
      drawSpectrum(values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      agentStage.style.setProperty("--voice-level", average.toFixed(2));
      meterFrame = requestAnimationFrame(update);
    };
    update();
  } catch {
    // 浏览器可能会拒绝麦克风分析，但语音识别仍可继续尝试。
  }
}

function stopMicrophoneMeter(stopTracks = true) {
  if (meterFrame) cancelAnimationFrame(meterFrame);
  meterFrame = null;
  if (stopTracks) microphoneStream?.getTracks().forEach((track) => track.stop());
  microphoneStream = null;
  if (audioContext && audioContext.state !== "closed") audioContext.close();
  audioContext = null;
  agentStage.style.removeProperty("--voice-level");
  resetSpectrum();
}

function animateOutputSpectrum(duration = 1800) {
  if (outputFrame) cancelAnimationFrame(outputFrame);
  voiceSpectrum.classList.add("active");
  const startedAt = performance.now();
  const update = (now) => {
    const elapsed = now - startedAt;
    const envelope = Math.max(0, 1 - elapsed / duration);
    const values = Array.from({ length: 14 }, (_, index) =>
      Math.min(1, (.2 + Math.abs(Math.sin(now / 115 + index * .78)) * .72) * (envelope * .55 + .45))
    );
    drawSpectrum(values);
    if (elapsed < duration) outputFrame = requestAnimationFrame(update);
    else resetSpectrum();
  };
  outputFrame = requestAnimationFrame(update);
}

setEmotion(companionMemory.emotionalState.tone || "calm");
updateRelationshipLabel();

if (window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let pointerFrame = null;
  window.addEventListener("pointermove", (event) => {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      const x = (event.clientX / window.innerWidth - .5) * 18;
      const y = (event.clientY / window.innerHeight - .5) * 14;
      document.documentElement.style.setProperty("--pointer-x", `${x.toFixed(1)}px`);
      document.documentElement.style.setProperty("--pointer-y", `${y.toFixed(1)}px`);
    });
  }, { passive: true });
}

function saveMemory() {
  companionMemory.updatedAt = Date.now();
  localStorage.setItem("anya-memory", JSON.stringify(companionMemory));
}

function addUniqueMemory(key, value, limit = 10) {
  const clean = String(value || "").trim().replace(/[。！？,.!?]+$/, "").slice(0, 80);
  if (!clean) return;
  companionMemory[key] = (companionMemory[key] || []).filter((item) => item !== clean);
  companionMemory[key].push(clean);
  companionMemory[key] = companionMemory[key].slice(-limit);
}

function learnFromMessage(text) {
  const nameMatch = text.match(/(?:我叫|叫我|我的名字是)\s*([\u4e00-\u9fa5a-zA-Z]{1,12})/);
  if (nameMatch) {
    companionMemory.name = nameMatch[1];
    userName = nameMatch[1];
  }

  const patterns = [
    ["likes", /(?:我(?:很|最)?喜欢|我爱)\s*([^，。！？,.!?]{1,40})/g],
    ["dislikes", /(?:我不喜欢|我讨厌)\s*([^，。！？,.!?]{1,40})/g],
    ["importantPeople", /(?:我的(?:妈妈|爸爸|朋友|同事|伴侣|男朋友|女朋友|老师)|对我很重要的人)([^，。！？,.!?]{0,40})/g],
    ["importantThings", /(?:请记住|帮我记住|别忘了)\s*([^，。！？,.!?]{1,60})/g],
  ];
  patterns.forEach(([key, pattern]) => {
    for (const match of text.matchAll(pattern)) addUniqueMemory(key, match[1] || match[0]);
  });

  const topic = text.split(/[，。！？；,.!?;]/).map((part) => part.trim()).find((part) => part.length >= 5);
  if (topic) addUniqueMemory("recentTopics", topic, 6);
  saveMemory();
  fetch("/api/proactive/context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memory: getMemorySnapshot() }),
  }).catch(() => {});
}

function getMemorySnapshot() {
  return {
    name: companionMemory.name,
    likes: companionMemory.likes,
    dislikes: companionMemory.dislikes,
    importantPeople: companionMemory.importantPeople,
    importantThings: companionMemory.importantThings,
    recentTopics: companionMemory.recentTopics,
    recentMood: companionMemory.moodHistory.at(-1)?.value || "",
    emotionalTone: emotionNames[companionMemory.emotionalState.tone] || "平静",
    relationshipStage: relationshipStage(),
    conversationDays: companionMemory.relationship.days.length,
  };
}

function memoryEntries() {
  const entries = [];
  if (companionMemory.name) entries.push({ key: "name", index: 0, type: "称呼", value: companionMemory.name });
  const labels = { likes: "喜欢", dislikes: "不喜欢", importantPeople: "重要的人", importantThings: "重要的事", recentTopics: "最近话题" };
  Object.entries(labels).forEach(([key, type]) => {
    (companionMemory[key] || []).forEach((value, index) => entries.push({ key, index, type, value }));
  });
  const latestMood = companionMemory.moodHistory.at(-1);
  if (latestMood) entries.push({ key: "moodHistory", index: companionMemory.moodHistory.length - 1, type: "最近心情", value: latestMood.value });
  return entries;
}

function renderMemory() {
  const entries = memoryEntries();
  memoryList.innerHTML = "";
  memoryCount.textContent = `${entries.length} 条记忆`;
  memoryClear.disabled = entries.length === 0;
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "memory-empty";
    empty.textContent = "还没有记忆。聊天时说“我喜欢…”或“请记住…”，Anya 就会认真收好。";
    memoryList.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "memory-item";
    const copy = document.createElement("div");
    const tag = document.createElement("span");
    tag.textContent = entry.type;
    const value = document.createElement("p");
    value.textContent = entry.value;
    copy.append(tag, value);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "删除";
    remove.setAttribute("aria-label", `删除记忆：${entry.value}`);
    remove.addEventListener("click", () => {
      if (entry.key === "name") {
        companionMemory.name = "";
        userName = "";
      } else {
        companionMemory[entry.key].splice(entry.index, 1);
      }
      saveMemory();
      renderMemory();
    });
    item.append(copy, remove);
    memoryList.appendChild(item);
  });
}

function speak(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1.03;
  window.speechSynthesis.speak(utterance);
}

function addMessage(text, sender, { useBrowserVoice = true } = {}) {
  const message = document.createElement("div");
  message.className = `message ${sender}-message`;

  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  message.appendChild(paragraph);
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  if (sender === "bot") {
    liveCaption.textContent = text;
    anyaAvatar.classList.add("speaking");
    agentStage.classList.remove("thinking", "listening");
    agentStage.classList.add("speaking");
    moodLabel.textContent = "Anyaが話しています";
    animateOutputSpectrum(Math.min(4200, Math.max(1800, text.length * 55)));
    window.setTimeout(() => {
      anyaAvatar.classList.remove("speaking");
      agentStage.classList.remove("speaking");
      moodLabel.textContent = "聞いている最中です";
    }, 1500);
    if (useBrowserVoice) speak(text);
  }
}

async function updateAiStatus() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    const { aiConfigured } = status;
    realtimeAvailable = Boolean(status.realtimeAvailable);
    if (aiConfigured) {
      aiStatus.textContent = "いつもあなたのそばにいるよ";
      aiStatus.classList.remove("offline");
      aiStatus.classList.add("online");
    }
  } catch {
    // 无法连接本地服务时，继续保留离线陪伴模式。
  }
}

updateAiStatus();

let pushRegistration = null;
let proactiveSettings = null;

function base64UrlToBytes(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getPushRegistration() {
  if (!("serviceWorker" in navigator)) throw new Error("当前浏览器不支持后台通知。");
  if (pushRegistration) return pushRegistration;
  pushRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return pushRegistration;
}

function updateCareStatus(enabled = false) {
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  carePermissionStatus.textContent = permission === "denied"
    ? "浏览器已阻止通知"
    : enabled && permission === "granted"
      ? "已开启，每天最多一条"
      : "当前未开启";
  careView.classList.toggle("care-active", enabled && permission === "granted");
  careTest.disabled = !(enabled && permission === "granted");
}

async function loadCareSettings() {
  const response = await fetch("/api/proactive");
  if (!response.ok) throw new Error("暂时无法读取主动关心设置。");
  proactiveSettings = await response.json();
  careEnabled.checked = proactiveSettings.enabled;
  careTime.value = proactiveSettings.time;
  quietStart.value = proactiveSettings.quietStart;
  quietEnd.value = proactiveSettings.quietEnd;
  updateCareStatus(proactiveSettings.enabled);
  return proactiveSettings;
}

async function ensurePushSubscription(publicKey) {
  if (!("Notification" in window) || !("PushManager" in window)) throw new Error("当前浏览器不支持后台通知。");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("需要允许浏览器通知，Anya 才能主动联系你。");
  const registration = await getPushRegistration();
  return await registration.pushManager.getSubscription() || registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(publicKey),
  });
}

getPushRegistration().catch(() => {});
loadCareSettings().catch(() => updateCareStatus(false));

function pick(replies) {
  return replies[Math.floor(Math.random() * replies.length)];
}

function withAnyaEnergy(reply) {
  const reactions = ["", "（Anya歪歪头）", "（Anya认真点头）", "（Anya抱紧小枕头）", "（Anya把小星星贴纸递过来）"];
  return `${pick(reactions)}${reply}`;
}

function showThinking() {
  agentStage.classList.add("thinking");
  const thinking = document.createElement("div");
  thinking.className = "message bot-message thinking";
  thinking.innerHTML = "<p>Anya在认真想…</p>";
  chatMessages.appendChild(thinking);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return thinking;
}

function rememberDetail(text) {
  const parts = text.split(/[，。！？；,.!?;]/).map((part) => part.trim()).filter(Boolean);
  const meaningful = parts.find((part) => part.length >= 5 && !/^(你好|在吗|谢谢|没事|好的)$/.test(part));
  if (meaningful) lastDetail = meaningful.slice(0, 28);
}

function rememberMood(text) {
  evolveFromConversation(text);
}

function personalOpening(text) {
  const subject = lastDetail || text.slice(0, 22);
  const name = userName ? `${userName}，` : "";
  return pick([
    `${name}Anya听见了：‘${subject}’。`,
    `${name}这句话里好像藏着不少心事。`,
    `${name}嗯，Anya先不急着给答案，想陪你把它说清楚一点。`,
  ]);
}

function getWarmReply(text) {
  const lowerText = text.toLowerCase();
  const urgentWords = ["自杀", "自残", "不想活", "伤害自己", "结束生命"];

  const nameMatch = text.match(/(?:我叫|叫我|我的名字是)\s*([\u4e00-\u9fa5a-zA-Z]{1,10})/);
  if (nameMatch) {
    userName = nameMatch[1];
    companionMemory.name = userName;
    saveMemory();
    return withAnyaEnergy(`记住啦，你是${userName}！Anya会这样叫你。认识你很开心。`);
  }

  if (urgentWords.some((word) => lowerText.includes(word))) {
    return "听起来你现在可能正承受很大的痛苦。请优先联系当地紧急服务、危机干预热线，或立刻告诉身边一位可信任的人；如果可以，先不要独自待着。";
  }

  if (lowerText.includes("怎么办") || lowerText.includes("怎么做")) {
    return withAnyaEnergy(`${personalOpening(text)}我们先不要一次解决全部。你愿意选一个最卡住的地方告诉Anya吗？我们只想下一小步。`);
  }

  if (lowerText.includes("你记得") || lowerText.includes("还记得")) {
    return withAnyaEnergy(lastDetail
      ? `当然记得呀。你刚才提到‘${lastDetail}’。Anya没有把它当成随便的话。`
      : "我们才刚开始聊天，不过你接下来告诉Anya的事，我会在这次聊天里好好记着。");
  }

  if (lowerText.includes("玩个小互动") || lowerText.includes("小游戏") || lowerText.includes("互动") || lowerText.includes("少し遊ぼう")) {
    lastTopic = "game";
    return withAnyaEnergy("好！秘密任务开始：请从‘云朵、热可可、猫咪’里选一个，Anya会告诉你今天的小幸运。直接把选项发给我！");
  }

  if (lastTopic === "game" && ["云朵", "热可可", "猫咪"].some((word) => text.includes(word))) {
    lastTopic = "";
    const fortunes = {
      云朵: "你选了云朵：今天适合把一件烦心事先放轻一点。慢慢飘过去，也是一种前进！",
      热可可: "你选了热可可：今天会有一个温暖的小瞬间，记得不要急着错过它。",
      猫咪: "你选了猫咪：今天的幸运技能是‘允许自己休息’。伸个懒腰也是完成任务。",
    };
    return withAnyaEnergy(fortunes[["云朵", "热可可", "猫咪"].find((word) => text.includes(word))]);
  }

  if (lowerText.includes("鼓励") || lowerText.includes("加油") || lowerText.includes("応援して")) {
    return withAnyaEnergy(pick([
      `${userName || "你"}已经走到这里了，这不是小事。接下来只做一小步，Anya给你加油！`,
      "今天不用变成超级厉害的人。把眼前的一件小事做好，就已经很棒。",
      "就算心里有点怕，也可以带着怕继续走。勇敢不是完全不害怕哦。",
    ]));
  }

  if (lowerText.includes("你好") || lowerText.includes("嗨") || lowerText.includes("在吗")) {
    return withAnyaEnergy(pick([
      "在！Anya正在认真值班。你今天想聊什么？",
      "哇，是你！快坐好，Anya已经准备好听故事了。",
      "当然在呀。今天的心情是晴天、阴天，还是有一点小雨？Anya想知道。",
    ]));
  }

  if (lowerText.includes("睡不着") || lowerText.includes("失眠")) {
    lastTopic = "sleep";
    return withAnyaEnergy(pick([
      "夜晚的脑袋有时会特别吵。先别逼自己立刻睡着，试试把手机放远一点，慢慢呼吸几次。",
      "睡不着真的很讨厌，像脑袋里有一群小人在跑步。现在最反复出现的念头是什么？",
      "今晚的任务不是马上睡着，是先让自己安静一点点。喝温水、松松肩膀，也算完成隐藏任务。",
    ]));
  }

  if (lowerText.includes("考试") || lowerText.includes("作业") || lowerText.includes("学习") || lowerText.includes("上课")) {
    lastTopic = "study";
    return withAnyaEnergy(pick([
      "学习任务像一座大山的时候，可以先把它切成小石头：先做 10 分钟，再决定下一步。",
      "Anya觉得你愿意开始就已经很厉害了！现在最难的是哪一题、哪一章，还是根本不知道从哪里开始？",
      "休息不是偷懒，是给脑袋补充能量。学一会儿、歇一会儿，这个计划像秘密行动一样可靠。",
    ]));
  }

  if (lowerText.includes("工作") || lowerText.includes("老板") || lowerText.includes("同事")) {
    lastTopic = "work";
    return withAnyaEnergy(pick([
      "工作里的麻烦有时像秘密任务一样多。先别急着一次解决全部，最需要处理的一件是什么？",
      "听起来这件工作上的事占了你不少心力。你已经做过哪些努力了？",
      "你不需要把每件事都做得完美。先完成最重要的一小步，剩下的任务晚一点再打败它们。",
    ]));
  }

  if (lowerText.includes("朋友") || lowerText.includes("家人") || lowerText.includes("恋爱") || lowerText.includes("分手")) {
    lastTopic = "relationship";
    return withAnyaEnergy(pick([
      "关系里的心情常常很复杂。Anya不急着下结论，想先知道，发生了什么？",
      "你在乎这段关系，所以心里才会乱成一团。你最希望对方听懂哪一句话？",
      "有些话说出口前，可以先写下来。Anya觉得这样能把乱糟糟的想法排成小队。",
    ]));
  }

  if (lowerText.includes("失败") || lowerText.includes("做不好") || lowerText.includes("没用") || lowerText.includes("笨")) {
    return withAnyaEnergy(pick([
      "一次没做好，不等于你不行。Anya觉得，愿意回头看一看已经很勇敢。",
      "你不是失败本身；你只是遇到了一次很不顺利的任务。下次只改一个小地方，也是在前进。",
      "别把自己骂得太厉害呀。把‘我好差’换成‘这件事很难，我还在学习’，会不会好一点？",
    ]));
  }

  if (lowerText.includes("难过") || lowerText.includes("伤心") || lowerText.includes("哭")) {
    lastTopic = "sad";
    return withAnyaEnergy(pick([
      `${personalOpening(text)}唔……听起来真的很难受。Anya想先陪你坐一会儿。你不用马上变好，可以告诉我，是哪件事让你这么难过吗？`,
      "想哭的时候哭出来也没关系。你已经一个人忍了多久了？Anya不催你。",
      "今天好像对你不太温柔。你可以把难过一小块、一小块地交给Anya。",
    ]));
  }

  if (lowerText.includes("累") || lowerText.includes("压力") || lowerText.includes("焦虑") || lowerText.includes("疲れた")) {
    lastTopic = "tired";
    return withAnyaEnergy(pick([
      `${personalOpening(text)}任务好多，脑袋会变得乱糟糟的吧。Anya提议先慢慢呼吸一次，然后只选一件最小的事情做，好不好？`,
      "你一直在努力撑住，所以才会累。现在能不能先让肩膀放松一点点？",
      "焦虑会催你快一点，可是你可以先慢一点。下一步小到‘喝口水’也可以，真的。",
    ]));
  }

  if (lowerText.includes("孤独") || lowerText.includes("一个人")) {
    lastTopic = "lonely";
    return withAnyaEnergy(pick([
      "一个人待着的时候，时间会变得很慢。谢谢你把这件事告诉Anya。要不要试着给可信任的人发一句：‘我今天有点不好’？",
      "孤独不是你的错。你现在愿意来这里说一句话，就已经是在向别人走近一点了。",
      "Anya会陪你聊天，但现实里的一个拥抱、一通电话也很重要。有没有一个让你觉得安全的人？",
    ]));
  }

  if (lowerText.includes("开心") || lowerText.includes("高兴") || lowerText.includes("谢谢") || lowerText.includes("うれしい")) {
    lastTopic = "happy";
    return withAnyaEnergy(pick([
      "真的吗？Anya也开心！快告诉我，是哪件好事让你露出笑脸了？",
      "好耶！这种小小的快乐值得多停留一会儿。",
      "听到你说谢谢，Anya心里也暖暖的。今天还有没有另一件值得记住的小事？",
    ]));
  }

  if (conversationTurn > 3 && lastTopic) {
    return withAnyaEnergy(pick([
      `Anya还记得我们在聊${lastTopic === "study" ? "学习" : lastTopic === "work" ? "工作" : "那件让你挂心的事"}。现在最让你在意的地方是什么？`,
      "我们已经聊了一会儿啦。你现在心里有没有比刚才松一点点？没有也没关系。",
    ]));
  }

  return withAnyaEnergy(pick([
    `${personalOpening(text)}你愿意再说一点吗？现在最希望有人理解你的哪一部分？`,
    `${personalOpening(text)}如果把这件事分成‘发生了什么’和‘你最在意什么’，你想先说哪一个？`,
    `${personalOpening(text)}Anya不想随便说‘没事的’敷衍你。你现在更想被安慰，还是更想一起想办法？`,
    `${personalOpening(text)}不用把话说得很完整，想到哪里就说到哪里。`,
  ]));
}

async function sendUserMessage() {
  const userText = userInput.value.trim();
  if (!userText) return;

  setEmotion(detectEmotion(userText));
  addMessage(userText, "user");
  userInput.value = "";
  conversationTurn += 1;
  rememberDetail(userText);
  rememberMood(userText);
  learnFromMessage(userText);
  const thinking = showThinking();
  moodLabel.textContent = "Anya在认真想…";
  aiStatus.textContent = "AI 正在思考";
  aiStatus.classList.remove("offline");
  aiStatus.classList.add("online");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userText,
        history: Array.from(chatMessages.querySelectorAll(".message"))
          .filter((message) => !message.classList.contains("thinking"))
          .slice(-24)
          .map((message) => ({
            role: message.classList.contains("user-message") ? "user" : "assistant",
            text: message.textContent.trim(),
          })),
        memory: getMemorySnapshot(),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI 服务暂时不可用");
    thinking.remove();
    agentStage.classList.remove("thinking");
    addMessage(data.reply, "bot");
    aiStatus.textContent = "いつもあなたのそばにいるよ";
  } catch {
    thinking.remove();
    agentStage.classList.remove("thinking");
    addMessage(getWarmReply(userText), "bot");
    aiStatus.textContent = "离线陪伴";
    aiStatus.classList.remove("online");
    aiStatus.classList.add("offline");
  }
  userInput.focus();
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendUserMessage();
});

document.querySelectorAll("[data-message]").forEach((button) => {
  button.addEventListener("click", () => {
    userInput.value = button.dataset.message;
    sendUserMessage();
  });
});

voiceToggle.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  voiceToggle.innerHTML = `<span class="tool-sound" aria-hidden="true"></span>${voiceEnabled ? "语音已开启" : "开启声音"}`;
});

memoryView.addEventListener("click", () => {
  renderMemory();
  memoryDialog.showModal();
});

memoryClose.addEventListener("click", () => memoryDialog.close());
memoryDialog.addEventListener("click", (event) => {
  if (event.target === memoryDialog) memoryDialog.close();
});
memoryClear.addEventListener("click", () => {
  if (!window.confirm("要清除 Anya 在这台设备上保存的全部长期记忆吗？")) return;
  Object.assign(companionMemory, {
    name: "", likes: [], dislikes: [], importantPeople: [], importantThings: [], recentTopics: [], moodHistory: [],
    emotionalState: { warmth: .52, energy: .5, concern: .16, tone: "calm" },
    relationship: { trust: 0, familiarity: 0, turns: 0, days: [], lastVisit: "" },
    emotionDiary: [], updatedAt: Date.now(),
  });
  userName = companionMemory.name;
  saveMemory();
  renderMemory();
  updateRelationshipLabel();
});

diaryView.addEventListener("click", () => {
  renderDiary();
  diaryDialog.showModal();
});
diaryClose.addEventListener("click", () => diaryDialog.close());
diaryDialog.addEventListener("click", (event) => {
  if (event.target === diaryDialog) diaryDialog.close();
});
diaryEnabled.addEventListener("change", () => {
  companionMemory.diaryEnabled = diaryEnabled.checked;
  saveMemory();
  renderDiary();
});
diaryClear.addEventListener("click", () => {
  if (!window.confirm("要删除全部情绪日记吗？长期记忆和关系变化会保留。")) return;
  companionMemory.emotionDiary = [];
  saveMemory();
  renderDiary();
});

function careTimeIsQuiet(time, start, end) {
  if (start === end) return false;
  return start < end ? time >= start && time < end : time >= start || time < end;
}

careView.addEventListener("click", async () => {
  careFeedback.textContent = "";
  try { await loadCareSettings(); } catch (error) { careFeedback.textContent = error.message; }
  careDialog.showModal();
});
careClose.addEventListener("click", () => careDialog.close());
careDialog.addEventListener("click", (event) => {
  if (event.target === careDialog) careDialog.close();
});
careForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  careFeedback.textContent = "正在保存…";
  if (careEnabled.checked && careTimeIsQuiet(careTime.value, quietStart.value, quietEnd.value)) {
    careFeedback.textContent = "关心时间在免打扰时段内，请换一个时间。";
    return;
  }
  try {
    const settings = proactiveSettings || await loadCareSettings();
    const subscription = careEnabled.checked ? await ensurePushSubscription(settings.publicKey) : null;
    const response = await fetch("/api/proactive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: careEnabled.checked,
        time: careTime.value,
        quietStart: quietStart.value,
        quietEnd: quietEnd.value,
        subscription: subscription?.toJSON() || null,
        memory: getMemorySnapshot(),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "保存失败。");
    proactiveSettings = { ...settings, enabled: data.enabled, time: careTime.value, quietStart: quietStart.value, quietEnd: quietEnd.value };
    updateCareStatus(data.enabled);
    careFeedback.textContent = data.enabled ? `已保存。Anya 会在每天 ${careTime.value} 轻轻问候你。` : "主动关心已暂停。";
  } catch (error) {
    careEnabled.checked = false;
    updateCareStatus(false);
    careFeedback.textContent = error.message || "主动关心设置失败。";
  }
});
careTest.addEventListener("click", async () => {
  careFeedback.textContent = "正在发送测试通知…";
  try {
    const response = await fetch("/api/proactive/test", { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "测试通知发送失败。");
    careFeedback.textContent = "测试通知已发送，请查看系统通知。";
  } catch (error) {
    careFeedback.textContent = error.message;
  }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

function setVoiceButton(label, active = false) {
  voiceInput.classList.toggle("listening", active);
  voiceInput.querySelector(".talk-label").textContent = label;
}

function stopRealtimeSession() {
  realtimeConnected = false;
  realtimeConnecting = false;
  realtimeChannel?.close();
  realtimePc?.close();
  realtimeChannel = null;
  realtimePc = null;
  if (realtimeAudio) {
    realtimeAudio.pause();
    realtimeAudio.srcObject = null;
    realtimeAudio.remove();
    realtimeAudio = null;
  }
  stopMicrophoneMeter(true);
  agentStage.classList.remove("listening", "thinking", "speaking");
  anyaAvatar.classList.remove("speaking");
  setVoiceButton("話しかける", false);
  moodLabel.textContent = "聞いている最中です";
  aiStatus.textContent = "いつもあなたのそばにいるよ";
}

function finishRealtimeReply() {
  const text = realtimeReplyText.trim();
  realtimeReplyText = "";
  if (text) {
    setEmotion(detectEmotion(text));
    addMessage(text, "bot", { useBrowserVoice: false });
  }
  if (realtimeConnected) {
    agentStage.classList.remove("speaking", "thinking");
    agentStage.classList.add("listening");
    moodLabel.textContent = "いつでも話してください";
  }
}

function handleRealtimeEvent(event) {
  if (event.type === "input_audio_buffer.speech_started") {
    window.speechSynthesis?.cancel();
    realtimeReplyText = "";
    liveCaption.textContent = "";
    agentStage.classList.remove("speaking", "thinking");
    agentStage.classList.add("listening");
    anyaAvatar.classList.remove("speaking");
    moodLabel.textContent = "声を聞いています…";
    return;
  }
  if (event.type === "input_audio_buffer.speech_stopped") {
    agentStage.classList.remove("listening", "speaking");
    agentStage.classList.add("thinking");
    moodLabel.textContent = "Anya在认真想…";
    return;
  }
  if (event.type === "conversation.item.input_audio_transcription.completed") {
    const transcript = String(event.transcript || "").trim();
    if (transcript) {
      addMessage(transcript, "user");
      liveCaption.textContent = transcript;
      setEmotion(detectEmotion(transcript));
      rememberDetail(transcript);
      rememberMood(transcript);
      learnFromMessage(transcript);
    }
    return;
  }
  if (["response.output_audio_transcript.delta", "response.audio_transcript.delta"].includes(event.type)) {
    realtimeReplyText += event.delta || "";
    liveCaption.textContent = realtimeReplyText;
    agentStage.classList.remove("listening", "thinking");
    agentStage.classList.add("speaking");
    anyaAvatar.classList.add("speaking");
    moodLabel.textContent = "Anyaが話しています";
    return;
  }
  if (["response.output_audio_transcript.done", "response.audio_transcript.done"].includes(event.type)) {
    if (event.transcript) realtimeReplyText = event.transcript;
    finishRealtimeReply();
    return;
  }
  if (event.type === "response.done") {
    if (realtimeReplyText) finishRealtimeReply();
    return;
  }
  if (event.type === "error") {
    liveCaption.textContent = event.error?.message || "实时语音暂时遇到问题";
  }
}

async function startRealtimeSession() {
  if (realtimeConnected || realtimeConnecting) {
    stopRealtimeSession();
    return true;
  }
  if (!realtimeAvailable || !window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) return false;

  realtimeConnecting = true;
  setVoiceButton("接続中…", true);
  moodLabel.textContent = "リアルタイム接続中…";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const pc = new RTCPeerConnection();
    realtimePc = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    await startMicrophoneMeter(stream);

    realtimeAudio = document.createElement("audio");
    realtimeAudio.autoplay = true;
    realtimeAudio.setAttribute("aria-hidden", "true");
    document.body.appendChild(realtimeAudio);
    pc.ontrack = (event) => {
      realtimeAudio.srcObject = event.streams[0];
      realtimeAudio.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState) && realtimeConnected) stopRealtimeSession();
    };

    const channel = pc.createDataChannel("oai-events");
    realtimeChannel = channel;
    channel.addEventListener("message", ({ data }) => {
      try { handleRealtimeEvent(JSON.parse(data)); } catch {}
    });
    channel.addEventListener("open", () => {
      realtimeConnected = true;
      realtimeConnecting = false;
      voiceEnabled = true;
      voiceToggle.innerHTML = '<span class="tool-sound" aria-hidden="true"></span>语音已开启';
      aiStatus.textContent = "いつもあなたのそばにいるよ";
      agentStage.classList.add("listening");
      setVoiceButton("会話中・タップで終了", true);
      moodLabel.textContent = "いつでも話してください";
      liveCaption.textContent = "";
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const response = await fetch("/api/realtime-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sdp: offer.sdp, memory: getMemorySnapshot() }),
    });
    const answer = await response.text();
    if (!response.ok) {
      let message = answer;
      try { message = JSON.parse(answer).error || message; } catch {}
      throw new Error(message);
    }
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
    return true;
  } catch (error) {
    console.warn("实时语音连接失败，改用浏览器语音识别：", error);
    stopRealtimeSession();
    liveCaption.textContent = "已切换到兼容语音模式";
    return false;
  }
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    let transcript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
      if (event.results[index].isFinal) voiceTranscript = transcript.trim();
    }
    liveCaption.textContent = transcript.trim();
  };
  recognition.onend = () => {
    stopMicrophoneMeter();
    voiceInput.classList.remove("listening");
    agentStage.classList.remove("listening");
    moodLabel.textContent = "聞いている最中です";
    voiceInput.innerHTML = '<span class="voice-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="talk-label">話しかける</span>';
    if (voiceTranscript) {
      userInput.value = voiceTranscript;
      voiceTranscript = "";
      sendUserMessage();
    } else {
      liveCaption.textContent = "";
    }
  };
  recognition.onerror = () => {
    voiceTranscript = "";
    moodLabel.textContent = "もう一度試してください";
  };
}

async function startFallbackVoiceConversation() {
  if (!recognition) {
    liveCaption.textContent = "当前浏览器不支持语音识别，请使用下方文字输入。";
    return;
  }
    if (voiceInput.classList.contains("listening")) {
      recognition.stop();
      return;
    }
    voiceTranscript = "";
    voiceEnabled = true;
    voiceToggle.innerHTML = '<span class="tool-sound" aria-hidden="true"></span>语音已开启';
    voiceInput.classList.add("listening");
    agentStage.classList.add("listening");
    moodLabel.textContent = "声を聞いています…";
    voiceInput.querySelector(".talk-label").textContent = "聞いています…";
    startMicrophoneMeter();
    try {
      recognition.start();
    } catch {
      stopMicrophoneMeter();
      voiceInput.classList.remove("listening");
      agentStage.classList.remove("listening");
    }
}

async function startVoiceConversation() {
  if (realtimeConnected || realtimeConnecting) {
    stopRealtimeSession();
    return;
  }
  const started = await startRealtimeSession();
  if (!started) await startFallbackVoiceConversation();
}

voiceInput.addEventListener("click", startVoiceConversation);
avatarHalo.addEventListener("click", startVoiceConversation);
avatarHalo.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    startVoiceConversation();
  }
});

newChatButton.addEventListener("click", () => {
  if (!window.confirm("要开始一段新对话吗？当前页面里的聊天内容会被清空。")) return;
  stopRealtimeSession();
  chatMessages.innerHTML = "";
  liveCaption.textContent = "";
  conversationTurn = 0;
  userName = companionMemory.name;
  lastTopic = "";
  lastDetail = "";
  setEmotion(companionMemory.emotionalState.tone || "calm");
  updateRelationshipLabel();
  resetSpectrum();
  userInput.focus();
});

window.addEventListener("beforeunload", stopRealtimeSession);
