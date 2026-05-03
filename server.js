const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const MANAGER_USERNAME = process.env.MANAGER_USERNAME || "ElzakaryGustinvil049";
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || "elzakaryg@gmail.com";
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PUBLIC_FILES = new Set([
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/assets/welcome-elza-coin039.png",
  "/assets/coin-elza-coin039.png",
  "/assets/auth-welcome-fresh.png",
  "/assets/elza-coin029.png"
]);

// Redeem codes database (in production, this would be in the database)
const REDEEM_CODES = {
  "WELCOME100": { points: 50000, usedBy: new Set() },
  "BONUS500": { points: 25000, usedBy: new Set() },
  "ELZA2024": { points: 100000, usedBy: new Set() },
  "STARTER": { points: 10000, usedBy: new Set() },
  "GOLD1000": { points: 500000, usedBy: new Set() }
};

const milestones = [
  { clicks: 150000, reward: 15 },
  { clicks: 200000, reward: 20 },
  { clicks: 99000000, reward: 99 }
];

fs.mkdirSync(DATA_DIR, { recursive: true });

let db = loadDb();
const sessions = new Map();

// Initialize new fields in db if they don't exist
if (!db.transactions) db.transactions = [];
if (!db.lastPointsGiveAt) db.lastPointsGiveAt = {};
if (!db.newUserCount) db.newUserCount = 0;

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: {}, claims: [] };
  }

  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function isManager(user) {
  return user.username === MANAGER_USERNAME && normalize(user.email) === normalize(MANAGER_EMAIL);
}

function getUnlockedReward(user) {
  return milestones.reduce((best, milestone) => {
    return user.clicks >= milestone.clicks ? milestone.reward : best;
  }, 0);
}

function publicUser(user) {
  const publicData = {
    username: user.username,
    email: user.email,
    clicks: user.clicks,
    isManager: isManager(user),
    autoClickLevel: user.autoClickLevel || 0,
    clickMultiplier: user.clickMultiplier || 1
  };
  
  // Include all upgrade ownership flags (autoclick1, autoclick2, etc.)
  for (const key in user) {
    if (key.startsWith('autoclick') || key.startsWith('multiplier')) {
      publicData[key] = user[key];
    }
  }
  
  return publicData;
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").filter(Boolean).map((cookie) => {
    const [key, ...value] = cookie.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}

function currentUser(req) {
  const sid = parseCookies(req).sid;
  const usernameKey = sessions.get(sid);
  return usernameKey ? db.users[usernameKey] : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error("Request too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
  });
}

function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url;

  if (!PUBLIC_FILES.has(requestPath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const filePath = path.join(__dirname, requestPath.replace("/", ""));
  const ext = path.extname(filePath);
  const type =
    ext === ".css" ? "text/css" :
    ext === ".js" ? "text/javascript" :
    ext === ".png" ? "image/png" :
    "text/html";

  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res) {
  try {
    if (req.method === "GET" && req.url === "/api/session") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "Not logged in." });
      
      // Auto-give 100000 points every 30 minutes
      const now = Date.now();
      const lastGiveTime = db.lastPointsGiveAt[normalize(user.username)] || 0;
      if (now - lastGiveTime > 30 * 60 * 1000) {
        user.clicks += 100000;
        db.lastPointsGiveAt[normalize(user.username)] = now;
        saveDb();
      }
      
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (req.method === "POST" && req.url === "/api/register") {
      const body = await readBody(req);
      const username = String(body.username || "").trim();
      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      const key = normalize(username);

      if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
        return sendJson(res, 400, { error: "Username must be 3-32 letters, numbers, dashes, or underscores." });
      }
      if (!email.toLowerCase().endsWith("@gmail.com")) {
        return sendJson(res, 400, { error: "Please register with a Gmail address." });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: "Password must be at least 6 characters." });
      }
      if (db.users[key]) {
        return sendJson(res, 409, { error: "That username already exists." });
      }

      db.users[key] = {
        username,
        email,
        passwordHash: hashPassword(password),
        clicks: 10000,
        lastClickAt: 0,
        autoClickLevel: 0,
        clickMultiplier: 1,
        createdAt: new Date().toISOString(),
        shareablePoints: 0
      };
      
      saveDb();

      const sid = crypto.randomBytes(32).toString("hex");
      sessions.set(sid, key);
      return sendJson(res, 201, { user: publicUser(db.users[key]) }, {
        "Set-Cookie": `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
      });
    }

    if (req.method === "POST" && req.url === "/api/login") {
      const body = await readBody(req);
      const key = normalize(body.username);
      const user = db.users[key];

      if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) {
        return sendJson(res, 401, { error: "Wrong username or password." });
      }

      const sid = crypto.randomBytes(32).toString("hex");
      sessions.set(sid, key);
      return sendJson(res, 200, { user: publicUser(user) }, {
        "Set-Cookie": `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
      });
    }

    if (req.method === "POST" && req.url === "/api/logout") {
      const sid = parseCookies(req).sid;
      sessions.delete(sid);
      return sendJson(res, 200, { ok: true }, {
        "Set-Cookie": "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
      });
    }

    if (req.method === "POST" && req.url === "/api/click") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "Please login first." });

      const now = Date.now();
      if (now - user.lastClickAt < 65) {
        return sendJson(res, 429, { error: "Click a little slower." });
      }

      const multiplier = user.clickMultiplier || 1;
      user.clicks += multiplier;
      user.lastClickAt = now;
      saveDb();
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (req.method === "POST" && req.url === "/api/autoclick") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "Please login first." });

      const body = await readBody(req);
      const amount = Number(body.amount || 0);

      if (amount > 0 && (user.autoClickLevel || 0) > 0) {
        user.clicks += amount;
        saveDb();
      }
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (req.method === "POST" && req.url === "/api/claims") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "Please login first." });

      const reward = getUnlockedReward(user);
      const body = await readBody(req);
      const walletType = String(body.walletType || "").trim();
      const walletAddress = String(body.walletAddress || "").trim();

      if (reward === 0) return sendJson(res, 400, { error: "Reach 150,000 clicks before requesting a transfer." });
      if (!walletType || !walletType.match(/^(Binance|Gift Card)$/)) return sendJson(res, 400, { error: "Choose Binance or Gift Card." });
      
      // Gift Card uses codes (shorter), Binance uses wallet addresses (longer)
      const minLength = walletType === "Gift Card" ? 6 : 8;
      const fieldName = walletType === "Gift Card" ? "Gift Card code" : "wallet address";
      if (walletAddress.length < minLength) return sendJson(res, 400, { error: `Enter a valid ${fieldName}.` });
      if (db.claims.some((claim) => claim.usernameKey === normalize(user.username) && claim.reward === reward)) {
        return sendJson(res, 409, { error: `You already requested the $${reward} reward.` });
      }

      const claim = {
        id: crypto.randomUUID(),
        usernameKey: normalize(user.username),
        username: user.username,
        reward,
        walletType,
        walletAddress,
        status: "pending_manager_review",
        createdAt: new Date().toISOString()
      };
      db.claims.push(claim);
      
      // Log transaction
      const transaction = {
        id: claim.id,
        type: "claim",
        usernameKey: normalize(user.username),
        username: user.username,
        amount: reward,
        method: walletType,
        address: walletAddress,
        status: "pending_manager_review",
        createdAt: new Date().toISOString()
      };
      db.transactions.push(transaction);
      
      saveDb();
      return sendJson(res, 201, { claim, user: publicUser(user) });
    }

    if (req.method === "GET" && req.url === "/api/manager") {
      const user = currentUser(req);
      if (!user || !isManager(user)) return sendJson(res, 403, { error: "Manager access only." });

      return sendJson(res, 200, {
        users: Object.values(db.users)
          .sort((a, b) => b.clicks - a.clicks)
          .map((storedUser) => ({
            ...publicUser(storedUser),
            reward: getUnlockedReward(storedUser)
          })),
        claims: db.claims,
        transactions: db.transactions || [],
        withdrawals: db.withdrawals || []
      });
    }

    if (req.method === "GET" && req.url === "/api/user/transactions") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "Please login first." });

      const userTransactions = (db.transactions || []).filter(t => t.usernameKey === normalize(user.username));
      return sendJson(res, 200, { transactions: userTransactions });
    }

    if (req.method === "POST" && req.url === "/api/admin/approve-withdrawal") {
      const user = currentUser(req);
      if (!user || !isManager(user)) return sendJson(res, 403, { error: "Manager access only." });

      const body = await readBody(req);
      const claimId = String(body.claimId || "").trim();
      
      const claim = db.claims.find(c => c.id === claimId);
      if (!claim) return sendJson(res, 404, { error: "Claim not found." });
      
      claim.status = "completed";
      claim.processedAt = new Date().toISOString();
      
      // Update transaction record
      const transaction = (db.transactions || []).find(t => t.id === claimId);
      if (transaction) {
        transaction.status = "completed";
        transaction.processedAt = new Date().toISOString();
      }
      
      saveDb();
      return sendJson(res, 200, { claim, transaction });
    }

    if (req.method === "POST" && req.url === "/api/admin/reject-withdrawal") {
      const user = currentUser(req);
      if (!user || !isManager(user)) return sendJson(res, 403, { error: "Manager access only." });

      const body = await readBody(req);
      const claimId = String(body.claimId || "").trim();
      
      const claim = db.claims.find(c => c.id === claimId);
      if (!claim) return sendJson(res, 404, { error: "Claim not found." });
      
      claim.status = "rejected";
      claim.rejectedAt = new Date().toISOString();
      
      // Update transaction record
      const transaction = (db.transactions || []).find(t => t.id === claimId);
      if (transaction) {
        transaction.status = "rejected";
        transaction.rejectedAt = new Date().toISOString();
      }
      
      saveDb();
      return sendJson(res, 200, { claim, transaction });
    }

    if (req.method === "POST" && req.url === "/api/upgrade") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "Please login first." });

      const body = await readBody(req);
      const upgradeId = String(body.upgradeId || "").trim();

      const upgrades = [
        { id: "autoclick1", cost: 5000, type: "autoclick", level: 1 },
        { id: "autoclick2", cost: 10000, type: "autoclick", level: 2 },
        { id: "multiplier2", cost: 50000, type: "multiplier", value: 2 },
        { id: "multiplier4", cost: 75000, type: "multiplier", value: 4 },
        { id: "autoclick10", cost: 99000, type: "autoclick", level: 10 },
        { id: "autoclick1000", cost: 5000, type: "autoclick", level: 1000, adminOnly: true }
      ];

      const upgrade = upgrades.find((u) => u.id === upgradeId);
      if (!upgrade) return sendJson(res, 400, { error: "Invalid upgrade." });

      // Check if admin-only upgrade and user is not admin
      if (upgrade.adminOnly && !isManager(user)) {
        return sendJson(res, 403, { error: "This upgrade is admin only." });
      }

      // Check if newUsers-only upgrade
      if (upgrade.newUsersOnly) {
        if (user[upgradeId]) {
          return sendJson(res, 400, { error: "You already own this upgrade." });
        }
        // Allow new users to get it for free
      } else {
        if (user[upgradeId]) {
          return sendJson(res, 400, { error: "You already own this upgrade." });
        }

        if (user.clicks < upgrade.cost) {
          return sendJson(res, 400, { error: "Not enough clicks for this upgrade." });
        }

        user.clicks -= upgrade.cost;
      }

      user[upgradeId] = true;

      if (upgrade.type === "autoclick") {
        user.autoClickLevel = (user.autoClickLevel || 0) + upgrade.level;
      } else if (upgrade.type === "multiplier") {
        user.clickMultiplier = (user.clickMultiplier || 1) * upgrade.value;
      }

      saveDb();
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (req.method === "POST" && req.url === "/api/admin/buy-x") {
      const user = currentUser(req);
      if (!user || !isManager(user)) return sendJson(res, 403, { error: "Admin access only." });

      const body = await readBody(req);
      const amount = Number(body.amount || 0);
      const cost = Number(body.cost || 0);

      if (amount <= 0 || cost <= 0) return sendJson(res, 400, { error: "Invalid amount or cost." });
      if (user.clicks < cost) return sendJson(res, 400, { error: "Not enough points." });

      user.clicks -= cost;
      user.clickMultiplier = (user.clickMultiplier || 1) * amount;
      saveDb();
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (req.method === "POST" && req.url === "/api/admin/give-free-x") {
      const user = currentUser(req);
      if (!user || !isManager(user)) return sendJson(res, 403, { error: "Admin access only." });

      // Give 20x multiplier to all users
      for (const storedUser of Object.values(db.users)) {
        storedUser.clickMultiplier = (storedUser.clickMultiplier || 1) * 20;
      }
      saveDb();
      return sendJson(res, 200, { 
        message: `Successfully gave 20x multiplier to ${Object.keys(db.users).length} users!`,
        user: publicUser(user) 
      });
    }

    if (req.method === "POST" && req.url === "/api/admin/share-points") {
      const user = currentUser(req);
      if (!user || !isManager(user)) return sendJson(res, 403, { error: "Admin access only." });

      const body = await readBody(req);
      const targetUsername = String(body.targetUsername || "").trim();
      const amount = Number(body.amount || 0);
      const targetKey = normalize(targetUsername);

      if (amount <= 0) return sendJson(res, 400, { error: "Amount must be greater than 0." });
      if (!db.users[targetKey]) return sendJson(res, 404, { error: "User not found." });
      
      const targetUser = db.users[targetKey];
      targetUser.clicks += amount;
      
      // Log transaction
      const transaction = {
        id: crypto.randomUUID(),
        type: "admin_share",
        fromUsername: user.username,
        toUsername: targetUsername,
        amount,
        status: "completed",
        createdAt: new Date().toISOString()
      };
      db.transactions.push(transaction);
      
      saveDb();
      return sendJson(res, 200, { 
        message: `Shared ${amount.toLocaleString('en-US')} points with ${targetUsername}`,
        transaction,
        user: publicUser(user)
      });
    }

    if (req.method === "POST" && req.url === "/api/admin/buy-points") {
      const user = currentUser(req);
      if (!user || !isManager(user)) return sendJson(res, 403, { error: "Admin access only." });

      const body = await readBody(req);
      const amount = Number(body.amount || 0);
      const cost = Number(body.cost || 0);

      if (amount <= 0 || cost <= 0) return sendJson(res, 400, { error: "Invalid amount or cost." });

      user.clicks += amount;
      saveDb();
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (req.method === "POST" && req.url === "/api/user/withdraw") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "Please login first." });

      const body = await readBody(req);
      const withdrawType = String(body.withdrawType || "").trim();
      const walletAddress = String(body.walletAddress || "").trim();
      const amount = Number(body.amount || 0);

      if (!withdrawType || !withdrawType.match(/^(Binance|Gift Card)$/)) {
        return sendJson(res, 400, { error: "Choose Binance or Gift Card." });
      }

      const reward = getUnlockedReward(user);
      if (reward === 0) {
        return sendJson(res, 400, { error: "Reach 150,000 clicks to unlock withdrawals." });
      }

      if (amount <= 0 || amount > reward) {
        return sendJson(res, 400, { error: `Invalid amount. You can withdraw $1-$${reward}.` });
      }

      const minLength = withdrawType === "Gift Card" ? 6 : 8;
      const fieldName = withdrawType === "Gift Card" ? "Gift Card code" : "wallet address";
      if (walletAddress.length < minLength) {
        return sendJson(res, 400, { error: `Enter a valid ${fieldName}.` });
      }

      // Check for recent withdrawals (fraud protection)
      const userWithdrawals = (db.withdrawals || []).filter(w => w.usernameKey === normalize(user.username));
      const lastWithdrawal = userWithdrawals[userWithdrawals.length - 1];
      
      if (lastWithdrawal) {
        const timeSinceLastWithdrawal = Date.now() - new Date(lastWithdrawal.createdAt).getTime();
        if (timeSinceLastWithdrawal < 5 * 60 * 1000) {
          return sendJson(res, 429, { error: "Please wait at least 5 minutes between withdrawals (fraud protection)." });
        }
      }

      // Add withdrawal to withdrawal record
      if (!db.withdrawals) {
        db.withdrawals = [];
      }

      const withdrawal = {
        id: crypto.randomUUID(),
        usernameKey: normalize(user.username),
        username: user.username,
        amount,
        withdrawType,
        walletAddress,
        status: "pending_verification",
        fraudCheck: "passed",
        createdAt: new Date().toISOString()
      };

      db.withdrawals.push(withdrawal);
      
      // Log transaction
      const transaction = {
        id: withdrawal.id,
        type: "withdrawal",
        usernameKey: normalize(user.username),
        username: user.username,
        amount,
        method: withdrawType,
        address: walletAddress,
        status: "pending_verification",
        fraudCheck: "passed",
        createdAt: new Date().toISOString()
      };
      db.transactions.push(transaction);
      
      saveDb();

      return sendJson(res, 200, { 
        user: publicUser(user),
        withdrawal
      });
    }

    if (req.method === "POST" && req.url === "/api/redeem") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "Please login first." });

      const body = await readBody(req);
      const code = String(body.code || "").trim().toUpperCase();

      if (!code || code.length < 4) {
        return sendJson(res, 400, { error: "Enter a valid redeem code." });
      }

      // Check if code exists
      const redeemCode = REDEEM_CODES[code];
      if (!redeemCode) {
        return sendJson(res, 404, { error: "Invalid redeem code." });
      }

      // Check if user already used this code
      if (redeemCode.usedBy.has(normalize(user.username))) {
        return sendJson(res, 409, { error: "You have already used this code." });
      }

      // Award points
      user.clicks += redeemCode.points;
      redeemCode.usedBy.add(normalize(user.username));
      
      // Log transaction
      const transaction = {
        id: crypto.randomUUID(),
        type: "redeem_code",
        usernameKey: normalize(user.username),
        username: user.username,
        code,
        amount: redeemCode.points,
        status: "completed",
        createdAt: new Date().toISOString()
      };
      db.transactions.push(transaction);
      
      saveDb();

      return sendJson(res, 200, { 
        user: publicUser(user),
        message: `Code redeemed! You received ${redeemCode.points.toLocaleString('en-US')} bonus points!`
      });
    }

    if (req.method === "POST" && req.url === "/api/admin/withdraw") {
      const user = currentUser(req);
      if (!user || !isManager(user)) return sendJson(res, 403, { error: "Admin access only." });

      const body = await readBody(req);
      const withdrawType = String(body.withdrawType || "").trim();
      const walletAddress = String(body.walletAddress || "").trim();
      const amount = Number(body.amount || 0);

      if (!withdrawType || !withdrawType.match(/^(Binance|Gift Card)$/)) {
        return sendJson(res, 400, { error: "Choose Binance or Gift Card." });
      }

      // Gift Card uses codes (shorter), Binance uses wallet addresses (longer)
      const minLength = withdrawType === "Gift Card" ? 6 : 8;
      const fieldName = withdrawType === "Gift Card" ? "Gift Card code" : "wallet address";
      if (walletAddress.length < minLength) {
        return sendJson(res, 400, { error: `Enter a valid ${fieldName}.` });
      }

      if (amount <= 0) {
        return sendJson(res, 400, { error: "Withdrawal amount must be greater than 0." });
      }

      // Fraud detection: Check for suspicious patterns
      const userWithdrawals = (db.withdrawals || []).filter(w => w.usernameKey === normalize(user.username));
      const lastWithdrawal = userWithdrawals[userWithdrawals.length - 1];
      
      if (lastWithdrawal) {
        const timeSinceLastWithdrawal = Date.now() - new Date(lastWithdrawal.createdAt).getTime();
        if (timeSinceLastWithdrawal < 5 * 60 * 1000) { // Less than 5 minutes
          return sendJson(res, 429, { error: "Please wait at least 5 minutes between withdrawals (fraud protection)." });
        }
      }

      // Add withdrawal to withdrawal record
      if (!db.withdrawals) {
        db.withdrawals = [];
      }

      const withdrawal = {
        id: crypto.randomUUID(),
        usernameKey: normalize(user.username),
        username: user.username,
        amount,
        withdrawType,
        walletAddress,
        status: "pending_verification",
        fraudCheck: "passed",
        createdAt: new Date().toISOString()
      };

      db.withdrawals.push(withdrawal);
      
      // Log transaction
      const transaction = {
        id: withdrawal.id,
        type: "withdrawal",
        usernameKey: normalize(user.username),
        username: user.username,
        amount,
        method: withdrawType,
        address: walletAddress,
        status: "pending_verification",
        fraudCheck: "passed",
        createdAt: new Date().toISOString()
      };
      db.transactions.push(transaction);
      
      saveDb();

      return sendJson(res, 200, { 
        user: publicUser(user),
        withdrawal
      });
    }

    sendJson(res, 404, { error: "API route not found." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error." });
  }
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Elza-coin059 running at http://localhost:${PORT}`);
});
