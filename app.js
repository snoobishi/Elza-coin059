const milestones = [
  { clicks: 150000, reward: 15 },
  { clicks: 200000, reward: 20 },
  { clicks: 99000000, reward: 99 }
];

const upgrades = [
  { id: 'autoclick1', name: 'Auto Clicker', description: 'Gain 1 auto click/sec', cost: 5000, type: 'autoclick', level: 1 },
  { id: 'autoclick2', name: '2x Auto Clicker', description: 'Gain 2 auto clicks/sec', cost: 10000, type: 'autoclick', level: 2 },
  { id: 'multiplier2', name: '2x Click Power', description: 'Double your click value', cost: 50000, type: 'multiplier', value: 2 },
  { id: 'multiplier4', name: '4x Click Power', description: 'Quadruple your click value', cost: 75000, type: 'multiplier', value: 4 },
  { id: 'autoclick10', name: '10x Auto Clicker', description: 'Gain 10 auto clicks/sec', cost: 99000, type: 'autoclick', level: 10 },
  { id: 'autoclick1000', name: '1000x Auto Clicker (Admin)', description: 'Gain 1000 auto clicks/sec - Admin Only', cost: 5000, type: 'autoclick', level: 1000, adminOnly: true }
];

let autoClickInterval = null;

let currentUser = null;

const authScreen = document.querySelector("#authScreen");
const gameScreen = document.querySelector("#gameScreen");
const authMessage = document.querySelector("#authMessage");
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const showLogin = document.querySelector("#showLogin");
const showRegister = document.querySelector("#showRegister");

const playerName = document.querySelector("#playerName");
const managerBadge = document.querySelector("#managerBadge");
const managerPanel = document.querySelector("#managerPanel");
const managerList = document.querySelector("#managerList");
const clickCount = document.querySelector("#clickCount");
const rewardAmount = document.querySelector("#rewardAmount");
const nextGoal = document.querySelector("#nextGoal");
const coinMessage = document.querySelector("#coinMessage");
const claimStatus = document.querySelector("#claimStatus");
const coinButton = document.querySelector("#coinButton");
const upgradesList = document.querySelector("#upgradesList");
const adminPanel = document.querySelector("#adminPanel");
const adminMessage = document.querySelector("#adminMessage");

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

function getUnlockedReward(user) {
  return milestones.reduce((best, milestone) => {
    return user.clicks >= milestone.clicks ? milestone.reward : best;
  }, 0);
}

function getNextMilestone(user) {
  return milestones.find((milestone) => user.clicks < milestone.clicks);
}

function showMessage(message, type = "") {
  authMessage.textContent = message;
  authMessage.className = `form-message ${type}`.trim();
}

function showClaim(message, type = "") {
  claimStatus.textContent = message;
  claimStatus.className = `claim-status ${type}`.trim();
}

function setAuthMode(mode) {
  const isLogin = mode === "login";
  loginForm.classList.toggle("active", isLogin);
  registerForm.classList.toggle("active", !isLogin);
  showLogin.classList.toggle("active", isLogin);
  showRegister.classList.toggle("active", !isLogin);
  showMessage("");
}

function startAutoClick() {
  if (autoClickInterval) clearInterval(autoClickInterval);
  if (!currentUser) return;

  const autoClickLevel = currentUser.autoClickLevel || 0;
  const clickMultiplier = currentUser.clickMultiplier || 1;

  if (autoClickLevel === 0) return;

  autoClickInterval = setInterval(async () => {
    if (!currentUser) return;
    try {
      const data = await api("/api/autoclick", { method: "POST", body: JSON.stringify({ amount: autoClickLevel * clickMultiplier }) });
      currentUser = data.user;
      render();
    } catch (error) {
      console.error(error);
    }
  }, 1000);
}

function renderUpgrades() {
  if (!currentUser) return;

  upgradesList.innerHTML = upgrades.map((upgrade) => {
    // Hide admin-only and new-users-only upgrades appropriately
    if (upgrade.adminOnly && !currentUser.isManager) return '';
    if (upgrade.newUsersOnly && currentUser.isManager) return '';

    const isOwned = currentUser[upgrade.id];
    const canAfford = currentUser.clicks >= upgrade.cost;
    const isDisabled = isOwned || (!canAfford && upgrade.cost > 0);

    let statusText = '';
    if (isOwned) statusText = '✓ Owned';
    else if (upgrade.cost === 0) statusText = 'Free';
    else if (canAfford) statusText = 'Buy now';
    else statusText = `Need ${(upgrade.cost - currentUser.clicks).toLocaleString('en-US')} more clicks`;

    const adminLabel = upgrade.adminOnly ? ' <span style="color: var(--gold); font-weight: 700;">⭐</span>' : '';
    const newUsersLabel = upgrade.newUsersOnly ? ' <span style="color: var(--gold); font-weight: 700;">🆕</span>' : '';

    return `
      <div class="upgrade-item ${isOwned ? 'owned' : ''} ${canAfford && !isOwned ? 'available' : ''}">
        <div class="upgrade-info">
          <strong>${upgrade.name}${adminLabel}${newUsersLabel}</strong>
          <p>${upgrade.description}</p>
          <span class="upgrade-cost">${upgrade.cost === 0 ? 'Free for new users' : upgrade.cost.toLocaleString('en-US') + ' clicks'}</span>
        </div>
        <button 
          class="upgrade-button ${isOwned ? 'owned-btn' : ''}" 
          ${isDisabled ? 'disabled' : ''}
          onclick="buyUpgrade('${upgrade.id}')" 
          type="button">
          ${statusText}
        </button>
      </div>
    `;
  }).join('');
}

async function buyUpgrade(upgradeId) {
  if (!currentUser) return;

  const upgrade = upgrades.find((u) => u.id === upgradeId);
  if (!upgrade) return;

  if (currentUser.clicks < upgrade.cost) {
    alert(`You need ${upgrade.cost.toLocaleString('en-US')} clicks for this upgrade.`);
    return;
  }

  try {
    const data = await api("/api/upgrade", {
      method: "POST",
      body: JSON.stringify({ upgradeId })
    });
    currentUser = data.user;
    startAutoClick();
    render();
    renderUpgrades();
  } catch (error) {
    alert(error.message);
  }
}

function render() {
  authScreen.classList.toggle("hidden", Boolean(currentUser));
  gameScreen.classList.toggle("hidden", !currentUser);

  if (!currentUser) return;

  const reward = getUnlockedReward(currentUser);
  const next = getNextMilestone(currentUser);

  playerName.textContent = currentUser.username;
  managerBadge.classList.toggle("hidden", !currentUser.isManager);
  managerPanel.classList.toggle("hidden", !currentUser.isManager);
  adminPanel.classList.toggle("hidden", !currentUser.isManager);
  clickCount.textContent = currentUser.clicks.toLocaleString("en-US");
  rewardAmount.textContent = `$${reward}`;
  nextGoal.textContent = next ? next.clicks.toLocaleString("en-US") : "Complete";

  if (next) {
    const remaining = next.clicks - currentUser.clicks;
    coinMessage.textContent = `${remaining.toLocaleString("en-US")} clicks until your next reward.`;
  } else {
    coinMessage.textContent = "You reached the top reward. Keep clicking to stay on the leaderboard.";
  }

  document.querySelectorAll("#milestoneList li").forEach((item) => {
    const goal = Number(item.dataset.goal);
    item.classList.toggle("reached", currentUser.clicks >= goal);
  });

  renderUpgrades();
  startAutoClick();

  if (currentUser.isManager) renderManager();
}

async function renderManager() {
  const data = await api("/api/manager");

  const usersHtml = data.users.map((user) => `
    <div>
      <span>${escapeHtml(user.username)} - ${escapeHtml(user.email)} - ${user.isManager ? "Manager" : "Player"}</span>
      <strong>${user.clicks.toLocaleString("en-US")} clicks / $${user.reward}</strong>
    </div>
  `).join("");

  const claimsHtml = data.claims.length ? data.claims.map((claim) => {
    const isPending = claim.status === "pending_manager_review";

    return `
      <div class="manager-claim">
        <span>
          ${escapeHtml(claim.username)} requested $${claim.reward} to ${escapeHtml(claim.walletType)}
          <small>${escapeHtml(claim.walletAddress)}</small>
        </span>
        <span class="manager-actions">
          <strong>${escapeHtml(claim.status)}</strong>
          ${isPending ? `
            <button type="button" onclick="reviewWithdrawal('${escapeHtml(claim.id)}', 'approve')">Accept</button>
            <button type="button" class="danger" onclick="reviewWithdrawal('${escapeHtml(claim.id)}', 'reject')">Reject</button>
          ` : ""}
        </span>
      </div>
    `;
  }).join("") : "";

  managerList.innerHTML = usersHtml + claimsHtml;
}

async function reviewWithdrawal(claimId, action) {
  if (!currentUser || !currentUser.isManager) return;

  const endpoint = action === "approve"
    ? "/api/admin/approve-withdrawal"
    : "/api/admin/reject-withdrawal";

  await api(endpoint, {
    method: "POST",
    body: JSON.stringify({ claimId })
  });

  await renderManager();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

async function loadSession() {
  try {
    const data = await api("/api/session");
    currentUser = data.user;
  } catch {
    currentUser = null;
  }

  render();
}

showLogin.addEventListener("click", () => setAuthMode("login"));
showRegister.addEventListener("click", () => setAuthMode("register"));

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");

  try {
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: document.querySelector("#registerUsername").value.trim(),
        email: document.querySelector("#registerEmail").value.trim(),
        password: document.querySelector("#registerPassword").value
      })
    });

    currentUser = data.user;
    registerForm.reset();
    render();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");

  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: document.querySelector("#loginUsername").value.trim(),
        password: document.querySelector("#loginPassword").value
      })
    });

    currentUser = data.user;
    loginForm.reset();
    render();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  currentUser = null;
  render();
});

coinButton.addEventListener("click", async () => {
  if (!currentUser) return;
  coinButton.disabled = true;

  try {
    const data = await api("/api/click", { method: "POST", body: "{}" });
    currentUser = data.user;
    render();
  } catch (error) {
    coinMessage.textContent = error.message;
  } finally {
    setTimeout(() => {
      coinButton.disabled = false;
    }, 70);
  }
});

// Update user withdraw field label and placeholder based on selected type
function updateUserWithdrawField() {
  const withdrawType = document.querySelector("input[name='withdrawUserType']:checked");
  if (!withdrawType) return;
  
  const type = withdrawType.value;
  const label = document.querySelector("#userWithdrawLabel");
  const address = document.querySelector("#userWithdrawAddress");

  if (type === "Gift Card") {
    label.textContent = "Gift Card code";
    address.placeholder = "Enter Gift Card code";
  } else {
    label.textContent = "Wallet address";
    address.placeholder = "Paste wallet address";
  }
}

// Listen for withdraw type changes on user withdraw form
document.addEventListener("change", function(e) {
  if (e.target.name === "withdrawUserType") {
    updateUserWithdrawField();
  }
});

// Initialize user withdraw field on load
updateUserWithdrawField();

// User withdrawal functionality
function showUserWithdrawMessage(message, type = "") {
  const status = document.querySelector("#userWithdrawStatus");
  status.textContent = message;
  status.className = `claim-status ${type}`.trim();
}

document.querySelector("#userWithdrawButton").addEventListener("click", async () => {
  if (!currentUser) return;

  const withdrawType = document.querySelector("input[name='withdrawUserType']:checked").value;
  const walletAddress = document.querySelector("#userWithdrawAddress").value.trim();
  const amount = Number(document.querySelector("#userWithdrawAmount").value);

  showUserWithdrawMessage("");

  const reward = getUnlockedReward(currentUser);
  
  if (reward === 0) {
    showUserWithdrawMessage("Reach 150,000 clicks to unlock withdrawals.", "error");
    return;
  }

  if (!withdrawType || !withdrawType.match(/^(Binance|Gift Card)$/)) {
    showUserWithdrawMessage("Select a valid withdrawal method.", "error");
    return;
  }

  const fieldName = withdrawType === "Gift Card" ? "Gift Card code" : "wallet address";
  const minLength = withdrawType === "Gift Card" ? 6 : 8;

  if (!walletAddress) {
    showUserWithdrawMessage(`Enter your ${fieldName}.`, "error");
    return;
  }

  if (walletAddress.length < minLength) {
    showUserWithdrawMessage(`Enter a valid ${fieldName} (at least ${minLength} characters).`, "error");
    return;
  }

  if (amount <= 0 || amount > reward) {
    showUserWithdrawMessage(`Enter a valid amount (1-${reward}).`, "error");
    return;
  }

  try {
    const data = await api("/api/user/withdraw", {
      method: "POST",
      body: JSON.stringify({ withdrawType, walletAddress, amount })
    });
    currentUser = data.user;
    showUserWithdrawMessage(`Withdrawal request submitted: $${amount} to ${withdrawType}. Pending verification.`, "success");
    document.querySelector("#userWithdrawAddress").value = "";
    document.querySelector("#userWithdrawAmount").value = "";
    render();
  } catch (error) {
    showUserWithdrawMessage(error.message, "error");
  }
});

// Redeem code functionality
function showRedeemMessage(message, type = "") {
  const status = document.querySelector("#redeemCodeStatus");
  status.textContent = message;
  status.className = `claim-status ${type}`.trim();
}

document.querySelector("#redeemCodeButton").addEventListener("click", async () => {
  if (!currentUser) return;

  const code = document.querySelector("#redeemCodeInput").value.trim();

  showRedeemMessage("");

  if (!code) {
    showRedeemMessage("Enter a redeem code.", "error");
    return;
  }

  if (code.length < 4) {
    showRedeemMessage("Enter a valid redeem code (at least 4 characters).", "error");
    return;
  }

  try {
    const data = await api("/api/redeem", {
      method: "POST",
      body: JSON.stringify({ code })
    });
    currentUser = data.user;
    showRedeemMessage(data.message || "Code redeemed successfully!", "success");
    document.querySelector("#redeemCodeInput").value = "";
    render();
    renderUpgrades();
  } catch (error) {
    showRedeemMessage(error.message, "error");
  }
});

// Old claim button functionality (kept for compatibility)
document.querySelector("#claimButton").addEventListener("click", async () => {
  if (!currentUser) return;

  const reward = getUnlockedReward(currentUser);
  const walletType = document.querySelector("input[name='walletType']:checked").value;
  const walletAddress = document.querySelector("#walletAddress").value.trim();

  showClaim("");

  if (reward === 0) {
    showClaim("Reach 150,000 clicks before requesting a transfer.", "error");
    return;
  }

  if (!walletAddress) {
    const fieldName = walletType === "Google Pay" ? "redeem code" : "wallet address";
    showClaim(`Enter your ${fieldName} before requesting a transfer.`, "error");
    return;
  }

  try {
    const data = await api("/api/claims", {
      method: "POST",
      body: JSON.stringify({ walletType, walletAddress })
    });
    currentUser = data.user;
    showClaim(`Your $${data.claim.reward} ${walletType} transfer request was saved for manager review.`, "success");
    render();
  } catch (error) {
    showClaim(error.message, "error");
  }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  if (autoClickInterval) clearInterval(autoClickInterval);
  await api("/api/logout", { method: "POST", body: "{}" });
  currentUser = null;
  render();
});

function showAdminMessage(message, type = "") {
  adminMessage.textContent = message;
  adminMessage.className = `admin-message ${type}`.trim();
  setTimeout(() => {
    if (adminMessage.textContent === message) {
      adminMessage.textContent = "";
      adminMessage.className = "admin-message";
    }
  }, 3000);
}

async function adminBuyX(amount, cost) {
  if (!currentUser || !currentUser.isManager) {
    showAdminMessage("Only admins can purchase.", "error");
    return;
  }

  if (currentUser.clicks < cost) {
    showAdminMessage(`You need ${cost.toLocaleString('en-US')} points. You have ${currentUser.clicks.toLocaleString('en-US')}.`, "error");
    return;
  }

  try {
    const data = await api("/api/admin/buy-x", {
      method: "POST",
      body: JSON.stringify({ amount, cost })
    });
    currentUser = data.user;
    showAdminMessage(`Successfully purchased ${amount.toLocaleString('en-US')}x!`, "success");
    render();
  } catch (error) {
    showAdminMessage(error.message, "error");
  }
}

async function adminGiveFreeX() {
  if (!currentUser || !currentUser.isManager) {
    showAdminMessage("Only admins can give free items.", "error");
    return;
  }

  try {
    const data = await api("/api/admin/give-free-x", {
      method: "POST",
      body: JSON.stringify({})
    });
    showAdminMessage(data.message || "Successfully gave 20x to all users!", "success");
    render();
  } catch (error) {
    showAdminMessage(error.message, "error");
  }
}

async function adminBuyPoints(amount, cost) {
  if (!currentUser || !currentUser.isManager) {
    showAdminMessage("Only admins can purchase.", "error");
    return;
  }

  try {
    const data = await api("/api/admin/buy-points", {
      method: "POST",
      body: JSON.stringify({ amount, cost })
    });
    currentUser = data.user;
    showAdminMessage(`Successfully purchased ${amount.toLocaleString('en-US')} points for $${cost}!`, "success");
    render();
  } catch (error) {
    showAdminMessage(error.message, "error");
  }
}

function showWithdrawalMessage(message, type = "") {
  const withdrawMessage = document.querySelector("#withdrawMessage");
  withdrawMessage.textContent = message;
  withdrawMessage.className = `withdrawal-message ${type}`.trim();
  setTimeout(() => {
    if (withdrawMessage.textContent === message) {
      withdrawMessage.textContent = "";
      withdrawMessage.className = "withdrawal-message";
    }
  }, 4000);
}


// Update admin withdrawal field based on selected type
function updateAdminWithdrawField() {
  const withdrawType = document.querySelector("input[name='withdrawType']:checked").value;
  const walletField = document.querySelector("#adminWalletAddress");

  if (withdrawType === "Gift Card") {
    walletField.placeholder = "Enter Gift Card code";
  } else {
    walletField.placeholder = "Enter your wallet address";
  }
}

// Listen for withdraw type changes
document.addEventListener("change", function(e) {
  if (e.target.name === "withdrawType") {
    updateAdminWithdrawField();
  }
});

// Initialize admin withdraw field
updateAdminWithdrawField();

async function adminWithdraw() {
  if (!currentUser || !currentUser.isManager) {
    showWithdrawalMessage("Only admins can withdraw.", "error");
    return;
  }

  const withdrawType = document.querySelector("input[name='withdrawType']:checked").value;
  const walletAddress = document.querySelector("#adminWalletAddress").value.trim();
  const amount = Number(document.querySelector("#withdrawAmount").value);

  showWithdrawalMessage("");

  if (!withdrawType || !withdrawType.match(/^(Binance|Gift Card)$/)) {
    showWithdrawalMessage("Select a valid wallet type.", "error");
    return;
  }

  const fieldName = withdrawType === "Gift Card" ? "Gift Card code" : "wallet address";
  const minLength = withdrawType === "Gift Card" ? 6 : 8;

  if (!walletAddress) {
    showWithdrawalMessage(`Enter your ${fieldName}.`, "error");
    return;
  }

  if (walletAddress.length < minLength) {
    showWithdrawalMessage(`Enter a valid ${fieldName} (at least ${minLength} characters).`, "error");
    return;
  }

  if (amount <= 0) {
    showWithdrawalMessage("Enter a valid withdrawal amount.", "error");
    return;
  }

  try {
    const data = await api("/api/admin/withdraw", {
      method: "POST",
      body: JSON.stringify({ withdrawType, walletAddress, amount })
    });
    currentUser = data.user;
    showWithdrawalMessage(`Withdrawal request submitted: $${amount.toLocaleString('en-US')} to ${withdrawType}. Pending verification.`, "success");
    document.querySelector("#adminWalletAddress").value = "";
    document.querySelector("#withdrawAmount").value = "";
    render();
  } catch (error) {
    showWithdrawalMessage(error.message, "error");
  }
}

async function adminSharePoints() {
  if (!currentUser || !currentUser.isManager) {
    showAdminMessage("Only admins can share points.", "error");
    return;
  }

  const targetUsername = prompt("Enter username to share points with:");
  if (!targetUsername) return;

  const amount = parseInt(prompt("Enter amount of points to share:"), 10);
  if (!amount || amount <= 0) {
    showAdminMessage("Invalid amount.", "error");
    return;
  }

  try {
    const data = await api("/api/admin/share-points", {
      method: "POST",
      body: JSON.stringify({ targetUsername, amount })
    });
    currentUser = data.user;
    showAdminMessage(`Shared ${amount.toLocaleString('en-US')} points with ${targetUsername}!`, "success");
    render();
  } catch (error) {
    showAdminMessage(error.message, "error");
  }
}

setAuthMode("login");
loadSession();
