let currentUser = JSON.parse(localStorage.getItem("user"));

function login(username, role) {
  currentUser = { username, role };
  localStorage.setItem("user", JSON.stringify(currentUser));
  renderAuth();
}

function logout() {
  currentUser = null;
  localStorage.removeItem("user");
  renderAuth();
}

function renderAuth() {
  document.getElementById("authBox").innerHTML = `
    <div class="box">
      <h3>Login</h3>
      <input id="username" placeholder="username"/>
      <select id="role">
        <option value="user">User</option>
        <option value="seller">Seller</option>
      </select>

      <button onclick="handleLogin()">Login</button>
      <button onclick="logout()">Logout</button>

      <p>${currentUser ? currentUser.username + " (" + currentUser.role + ")" : "Chưa login"}</p>
    </div>
  `;
}

function handleLogin() {
  const u = document.getElementById("username").value;
  const r = document.getElementById("role").value;
  login(u, r);
}

renderAuth();