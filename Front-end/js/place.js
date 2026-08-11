let places = Storage.get("places");

places.forEach(p => createMarker(p));

map.on("click", function(e) {

  if (!currentUser || currentUser.role !== "seller") {
    alert("Chỉ seller được thêm quán");
    return;
  }

  const popup = `
    <div>
      <input id="pname" placeholder="Tên quán"/>
      <textarea id="pdesc" placeholder="Mô tả"></textarea>
      <button onclick="savePlace(${e.latlng.lat},${e.latlng.lng})">
        Lưu
      </button>
    </div>
  `;

  L.popup().setLatLng(e.latlng).setContent(popup).openOn(map);
});

function savePlace(lat, lng) {

  const name = document.getElementById("pname").value;
  const desc = document.getElementById("pdesc").value;

  const place = {
    id: Date.now(),
    name,
    desc,
    lat,
    lng,
    owner: currentUser.username
  };

  places.push(place);
  Storage.set("places", places);

  createMarker(place);
  map.closePopup();
}

function createMarker(p) {

  const isSeller = currentUser?.role === "seller";

  const popupContent = `
    <b>${p.name}</b><br/>
    ${p.desc}<br/><br/>

    ${isSeller ? `
      <button onclick="openEditForm(${p.id})"> Sửa</button>
      <button onclick="deletePlace(${p.id})"> Xoá</button>
    ` : ""}
  `;

  L.marker([p.lat, p.lng])
    .addTo(map)
    .bindPopup(popupContent);
}