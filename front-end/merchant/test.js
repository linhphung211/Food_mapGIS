const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><div id="map"></div>`);
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
const L = require("leaflet");
const map = L.map('map').setView([0,0], 1);
console.log(document.getElementById('map').innerHTML);
