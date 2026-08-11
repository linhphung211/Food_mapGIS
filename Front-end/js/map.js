const map = L.map('map').setView([21.0285, 105.8542], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
.addTo(map);