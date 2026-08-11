let comments = Storage.get("comments");

function renderComments() {
  document.getElementById("commentBox").innerHTML = `
    <div class="box">
      <h3>Comment</h3>

      <textarea id="cmt"></textarea>
      <button onclick="addComment()">Gửi</button>

      <ul>
        ${comments.map((c,i)=>`
          <li>
            ${c.user}: ${c.text}
            ${c.user === currentUser?.username
              ? `<button onclick="deleteComment(${i})">x</button>` : ""}
          </li>
        `).join("")}
      </ul>
    </div>
  `;
}

function addComment() {
  const text = document.getElementById("cmt").value;

  comments.push({
    user: currentUser.username,
    text
  });

  Storage.set("comments", comments);
  renderComments();
}

function deleteComment(i) {
  comments.splice(i,1);
  Storage.set("comments", comments);
  renderComments();
}

renderComments();